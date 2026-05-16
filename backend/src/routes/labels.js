const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/authenticate');

const prisma = new PrismaClient();
router.use(authenticate);

// ── List labels ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const labels = await prisma.label.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { notes: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(labels);
  } catch (err) {
    next(err);
  }
});

// ── Create label ──────────────────────────────────────────────────────
router.post('/',
  [
    body('name').trim().isLength({ min: 1, max: 50 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const label = await prisma.label.create({
        data: {
          name: req.body.name,
          color: req.body.color || '#6366f1',
          userId: req.userId,
        },
      });
      res.status(201).json(label);
    } catch (err) {
      if (err.code === 'P2002')
        return res.status(409).json({ message: 'Nhãn này đã tồn tại' });
      next(err);
    }
  }
);

// ── Update label ──────────────────────────────────────────────────────
router.patch('/:id',
  [
    body('name').optional().trim().isLength({ min: 1, max: 50 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  async (req, res, next) => {
    try {
      const label = await prisma.label.findUnique({ where: { id: req.params.id } });
      if (!label || label.userId !== req.userId)
        return res.status(403).json({ message: 'Không có quyền' });

      const updated = await prisma.label.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.color && { color: req.body.color }),
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ── Delete label (notes are kept) ─────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const label = await prisma.label.findUnique({ where: { id: req.params.id } });
    if (!label || label.userId !== req.userId)
      return res.status(403).json({ message: 'Không có quyền' });

    // NoteLabel entries deleted via cascade
    await prisma.label.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa nhãn' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
