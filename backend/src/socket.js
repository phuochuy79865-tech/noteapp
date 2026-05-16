const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const logger = require('./utils/logger');

const prisma = new PrismaClient();

// Track active rooms: noteId -> Set of { userId, socketId, displayName, avatarUrl }
const activeRooms = new Map();

function setupSocketIO(io) {
  // ── Auth Middleware ────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, displayName: true, avatarUrl: true },
      });
      if (!user) return next(new Error('User not found'));

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} | user: ${socket.userId}`);

    // ── Join note room for collaboration ─────────────────────────────
    socket.on('note:join', async ({ noteId }) => {
      try {
        // Check permission
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) return socket.emit('error', { message: 'Note not found' });

        const hasAccess = note.authorId === socket.userId ||
          (await prisma.noteShare.findUnique({
            where: { noteId_sharedWithId: { noteId, sharedWithId: socket.userId } },
          }));

        if (!hasAccess) return socket.emit('error', { message: 'Access denied' });

        const room = `note:${noteId}`;
        socket.join(room);
        socket.currentNoteId = noteId;

        // Track collaborator
        if (!activeRooms.has(noteId)) activeRooms.set(noteId, new Map());
        activeRooms.get(noteId).set(socket.userId, {
          userId: socket.userId,
          socketId: socket.id,
          displayName: socket.user.displayName,
          avatarUrl: socket.user.avatarUrl,
        });

        // Notify others in room
        const collaborators = Array.from(activeRooms.get(noteId).values());
        io.to(room).emit('note:collaborators', { collaborators });
        socket.to(room).emit('note:user_joined', { user: socket.user });

        logger.info(`User ${socket.userId} joined note room ${noteId}`);
      } catch (err) {
        logger.error('note:join error', err);
        socket.emit('error', { message: 'Failed to join note' });
      }
    });

    // ── Leave note room ───────────────────────────────────────────────
    socket.on('note:leave', ({ noteId }) => {
      leaveRoom(socket, io, noteId);
    });

    // ── Real-time content change ──────────────────────────────────────
    socket.on('note:change', async ({ noteId, field, value }) => {
      try {
        if (!['title', 'content'].includes(field)) return;

        // Check edit permission
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) return;

        const canEdit = note.authorId === socket.userId ||
          (await prisma.noteShare.findFirst({
            where: { noteId, sharedWithId: socket.userId, permission: 'edit' },
          }));

        if (!canEdit) return socket.emit('error', { message: 'No edit permission' });

        // Broadcast to others in the room (not sender)
        socket.to(`note:${noteId}`).emit('note:changed', {
          noteId,
          field,
          value,
          userId: socket.userId,
        });

        // Debounce DB save via timeout tracking (per-note)
        if (!socket.saveTimers) socket.saveTimers = {};
        clearTimeout(socket.saveTimers[noteId]);
        socket.saveTimers[noteId] = setTimeout(async () => {
          await prisma.note.update({
            where: { id: noteId },
            data: { [field]: value },
          });
        }, 500);
      } catch (err) {
        logger.error('note:change error', err);
      }
    });

    // ── Cursor position ───────────────────────────────────────────────
    socket.on('note:cursor', ({ noteId, position }) => {
      socket.to(`note:${noteId}`).emit('note:cursor_moved', {
        userId: socket.userId,
        displayName: socket.user.displayName,
        position,
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.currentNoteId) {
        leaveRoom(socket, io, socket.currentNoteId);
      }
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

function leaveRoom(socket, io, noteId) {
  const room = `note:${noteId}`;
  socket.leave(room);

  if (activeRooms.has(noteId)) {
    activeRooms.get(noteId).delete(socket.userId);
    if (activeRooms.get(noteId).size === 0) {
      activeRooms.delete(noteId);
    } else {
      const collaborators = Array.from(activeRooms.get(noteId).values());
      io.to(room).emit('note:collaborators', { collaborators });
    }
  }

  socket.to(room).emit('note:user_left', { userId: socket.userId });
}

module.exports = { setupSocketIO };
