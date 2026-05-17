const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const logger = require('./utils/logger');
const { setupSocketIO } = require('./socket');

const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');
const labelRoutes = require('./routes/labels');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');

const { errorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

// ================= ALLOWED ORIGINS =================
const allowedOrigins = [
  'http://localhost:5173',
  'https://noteapp-frontend-pi.vercel.app',
];

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setupSocketIO(io);

// ================= MIDDLEWARE =================
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(compression());

// ================= CORS =================
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(generalLimiter);

// ================= STATIC FILES =================
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

// ================= ROOT ROUTE =================
app.get('/', (req, res) => {
  res.json({
    message: 'NoteApp Backend API Running',
    status: 'success',
  });
});

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ================= API ROUTES =================
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };