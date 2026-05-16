const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');

const prisma = new PrismaClient();
router.use(authenticate);

// ── Get current user profile ──────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isActivated: true,
        theme: true,
        fontFamily: true,
        noteColor: true,
        viewMode: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── Update profile ────────────────────────────────────────────────────
router.patch('/me',
  [
    body('displayName').optional().trim().isLength({ min: 2, max: 50 }),
    body('theme').optional().isIn(['light', 'dark']),
    body('fontFamily').optional().isString(),
    body('noteColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('viewMode').optional().isIn(['grid', 'list']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const { displayName, theme, fontFamily, noteColor, viewMode } = req.body;

      const updated = await prisma.user.update({
        where: { id: req.userId },
        data: {
          ...(displayName && { displayName }),
          ...(theme && { theme }),
          ...(fontFamily && { fontFamily }),
          ...(noteColor && { noteColor }),
          ...(viewMode && { viewMode }),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          isActivated: true,
          theme: true,
          fontFamily: true,
          noteColor: true,
          viewMode: true,
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ── Update avatar ─────────────────────────────────────────────────────
router.patch('/me/avatar', async (req, res, next) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl)
      return res.status(400).json({ message: 'avatarUrl là bắt buộc' });

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── Change password ───────────────────────────────────────────────────
router.patch('/me/password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
    body('confirmPassword').custom((val, { req }) => {
      if (val !== req.body.newPassword) throw new Error('Mật khẩu không khớp');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!valid)
        return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });

      const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });

      res.json({ message: 'Đã đổi mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
