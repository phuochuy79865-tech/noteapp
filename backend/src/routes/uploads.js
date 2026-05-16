const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');

const prisma = new PrismaClient();
router.use(authenticate);

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Chỉ chấp nhận file ảnh'));
    }
    cb(null, true);
  },
});

// ── Upload images to a note ───────────────────────────────────────────
router.post('/notes/:noteId/images',
  upload.array('images', 10),
  async (req, res, next) => {
    try {
      const note = await prisma.note.findUnique({ where: { id: req.params.noteId } });
      if (!note || note.authorId !== req.userId)
        return res.status(403).json({ message: 'Không có quyền' });

      const uploaded = [];
      for (const file of req.files) {
        const filename = `${uuidv4()}.webp`;
        const filepath = path.join(UPLOADS_DIR, filename);

        await sharp(file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(filepath);

        const stats = fs.statSync(filepath);
        const image = await prisma.noteImage.create({
          data: {
            noteId: req.params.noteId,
            url: `/uploads/${filename}`,
            filename,
            size: stats.size,
          },
        });
        uploaded.push(image);
      }

      res.status(201).json(uploaded);
    } catch (err) {
      next(err);
    }
  }
);

// ── Delete image ──────────────────────────────────────────────────────
router.delete('/images/:imageId', async (req, res, next) => {
  try {
    const image = await prisma.noteImage.findUnique({
      where: { id: req.params.imageId },
      include: { note: true },
    });

    if (!image || image.note.authorId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền' });

    // Delete file
    const filepath = path.join(UPLOADS_DIR, image.filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    await prisma.noteImage.delete({ where: { id: req.params.imageId } });
    res.json({ message: 'Đã xóa ảnh' });
  } catch (err) {
    next(err);
  }
});

// ── Upload avatar ─────────────────────────────────────────────────────
router.post('/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: 'Không có file được gửi' });

    const filename = `avatar_${req.userId}_${uuidv4()}.webp`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await sharp(req.file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 90 })
      .toFile(filepath);

    const avatarUrl = `/uploads/${filename}`;
    await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
    });

    res.json({ avatarUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
