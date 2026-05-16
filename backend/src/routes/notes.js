const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');
const { sendShareEmail } = require('../utils/mailer');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// All routes require auth
router.use(authenticate);

const noteSelect = {
  id: true,
  title: true,
  content: true,
  isPinned: true,
  isLocked: true,
  color: true,
  fontFamily: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  images: { select: { id: true, url: true, filename: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
  shares: {
    select: {
      id: true,
      permission: true,
      sharedWith: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
  },
};

// ── List notes ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { search, labelId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      OR: [
        { authorId: req.userId },
        { shares: { some: { sharedWithId: req.userId } } },
      ],
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(labelId && { labels: { some: { labelId } } }),
    };

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        select: noteSelect,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.note.count({ where }),
    ]);

    // Normalize labels
    const normalized = notes.map((n) => ({
      ...n,
      labels: n.labels.map((l) => l.label),
      isShared: n.shares.length > 0,
      isOwner: n.authorId === req.userId,
    }));

    res.json({ notes: normalized, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// ── Create note ───────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { title = '', content = '', color, fontFamily, labelIds = [] } = req.body;

    const note = await prisma.note.create({
      data: {
        title,
        content,
        color,
        fontFamily,
        authorId: req.userId,
        labels: {
          create: labelIds.map((id) => ({ labelId: id })),
        },
      },
      select: noteSelect,
    });

    res.status(201).json({
      ...note,
      labels: note.labels.map((l) => l.label),
      isShared: false,
      isOwner: true,
    });
  } catch (err) {
    next(err);
  }
});

// ── Get single note ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const note = await getAccessibleNote(req.params.id, req.userId);
    if (!note) return res.status(404).json({ message: 'Không tìm thấy ghi chú' });

    res.json({
      ...note,
      labels: note.labels.map((l) => l.label),
      isShared: note.shares.length > 0,
      isOwner: note.authorId === req.userId,
    });
  } catch (err) {
    next(err);
  }
});

// ── Update note (auto-save) ───────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const note = await getAccessibleNote(req.params.id, req.userId);
    if (!note) return res.status(404).json({ message: 'Không tìm thấy ghi chú' });

    const canEdit =
      note.authorId === req.userId ||
      note.shares.some(
        (s) => s.sharedWith.id === req.userId && s.permission === 'edit'
      );

    if (!canEdit)
      return res.status(403).json({ message: 'Không có quyền chỉnh sửa' });

    const { title, content, color, fontFamily, isPinned, labelIds } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (color !== undefined) updateData.color = color;
    if (fontFamily !== undefined) updateData.fontFamily = fontFamily;
    if (isPinned !== undefined) updateData.isPinned = isPinned;

    // Update labels if provided
    if (labelIds !== undefined) {
      await prisma.noteLabel.deleteMany({ where: { noteId: req.params.id } });
      updateData.labels = {
        create: labelIds.map((id) => ({ labelId: id })),
      };
    }

    const updated = await prisma.note.update({
      where: { id: req.params.id },
      data: updateData,
      select: noteSelect,
    });

    res.json({
      ...updated,
      labels: updated.labels.map((l) => l.label),
      isShared: updated.shares.length > 0,
      isOwner: updated.authorId === req.userId,
    });
  } catch (err) {
    next(err);
  }
});

// ── Delete note ───────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.authorId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền xóa ghi chú này' });

    await prisma.note.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa ghi chú' });
  } catch (err) {
    next(err);
  }
});

// ── Lock note ─────────────────────────────────────────────────────────
router.post('/:id/lock', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4)
      return res.status(400).json({ message: 'Mật khẩu tối thiểu 4 ký tự' });

    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.authorId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền' });

    const lockHash = await bcrypt.hash(password, 10);
    await prisma.note.update({
      where: { id: req.params.id },
      data: { isLocked: true, lockHash },
    });

    res.json({ message: 'Ghi chú đã được khóa' });
  } catch (err) {
    next(err);
  }
});

// ── Unlock note ───────────────────────────────────────────────────────
router.post('/:id/unlock', async (req, res, next) => {
  try {
    const { password } = req.body;
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Không tìm thấy ghi chú' });

    const valid = await bcrypt.compare(password, note.lockHash || '');
    if (!valid)
      return res.status(401).json({ message: 'Mật khẩu không đúng' });

    res.json({ unlocked: true });
  } catch (err) {
    next(err);
  }
});

// ── Remove lock ───────────────────────────────────────────────────────
router.delete('/:id/lock', async (req, res, next) => {
  try {
    const { password } = req.body;
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.authorId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền' });

    const valid = await bcrypt.compare(password, note.lockHash || '');
    if (!valid)
      return res.status(401).json({ message: 'Mật khẩu không đúng' });

    await prisma.note.update({
      where: { id: req.params.id },
      data: { isLocked: false, lockHash: null },
    });

    res.json({ message: 'Đã gỡ khóa ghi chú' });
  } catch (err) {
    next(err);
  }
});

// ── Share note ────────────────────────────────────────────────────────
router.post('/:id/share',
  [
    body('email').isEmail().normalizeEmail(),
    body('permission').isIn(['view', 'edit']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const note = await prisma.note.findUnique({ where: { id: req.params.id } });
      if (!note || note.authorId !== req.userId)
        return res.status(403).json({ message: 'Chỉ chủ sở hữu mới có thể chia sẻ' });

      const { email, permission } = req.body;

      const targetUser = await prisma.user.findUnique({ where: { email } });
      if (!targetUser)
        return res.status(404).json({ message: 'Không tìm thấy người dùng với email này' });

      if (targetUser.id === req.userId)
        return res.status(400).json({ message: 'Không thể chia sẻ với chính mình' });

      const share = await prisma.noteShare.upsert({
        where: { noteId_sharedWithId: { noteId: req.params.id, sharedWithId: targetUser.id } },
        update: { permission },
        create: {
          noteId: req.params.id,
          sharedById: req.userId,
          sharedWithId: targetUser.id,
          permission,
        },
        select: {
          id: true,
          permission: true,
          sharedWith: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
      });

      // Send share notification email
      sendShareEmail(
        targetUser.email,
        targetUser.displayName,
        note.title || 'Ghi chú không có tiêu đề',
        permission
      ).catch((err) => logger.error('Share email failed', err));

      res.json(share);
    } catch (err) {
      next(err);
    }
  }
);

// ── Remove share ──────────────────────────────────────────────────────
router.delete('/:id/share/:shareId', async (req, res, next) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } });
    if (!note || note.authorId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền' });

    await prisma.noteShare.delete({ where: { id: req.params.shareId } });
    res.json({ message: 'Đã hủy chia sẻ' });
  } catch (err) {
    next(err);
  }
});

// ── Helper ─────────────────────────────────────────────────────────────
async function getAccessibleNote(noteId, userId) {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      OR: [
        { authorId: userId },
        { shares: { some: { sharedWithId: userId } } },
      ],
    },
    select: noteSelect,
  });
  return note;
}

module.exports = router;
