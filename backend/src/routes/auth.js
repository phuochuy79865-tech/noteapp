const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const {
  sendActivationEmail,
  sendPasswordResetEmail,
} = require('../utils/mailer');

const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ================= JWT TOKEN =================
const generateToken = (userId) =>
  jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );

// ======================================================
// REGISTER
// ======================================================
router.post(
  '/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email không hợp lệ'),

    body('displayName')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Tên hiển thị phải từ 2-50 ký tự'),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu tối thiểu 6 ký tự'),

    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
  ],

  async (req, res, next) => {
    try {
      // ===== VALIDATION =====
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }

      const {
        email,
        displayName,
        password,
      } = req.body;

      // ===== CHECK EXISTING USER =====
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          message: 'Email đã được sử dụng',
        });
      }

      // ===== HASH PASSWORD =====
      const passwordHash = await bcrypt.hash(password, 12);

      // ===== CREATE ACTIVATION TOKEN =====
      const activationToken = uuidv4();

      // ===== CREATE USER =====
      const user = await prisma.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          activationToken,
        },

        select: {
          id: true,
          email: true,
          displayName: true,
          isActivated: true,
        },
      });

      // ===== SEND ACTIVATION EMAIL =====
      sendActivationEmail(
        user.email,
        user.displayName,
        activationToken
      ).catch((err) => {
        logger.error('Activation email failed', err);
      });

      // ===== JWT =====
      const token = generateToken(user.id);

      logger.info(`User registered: ${user.email}`);

      return res.status(201).json({
        message:
          'Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.',
        token,
        user,
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

// ======================================================
// LOGIN
// ======================================================
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail(),

    body('password')
      .notEmpty(),
  ],

  async (req, res, next) => {
    try {

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // ===== FIND USER =====
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(401).json({
          message: 'Email hoặc mật khẩu không đúng',
        });
      }

      // ===== CHECK PASSWORD =====
      const validPassword = await bcrypt.compare(
        password,
        user.passwordHash
      );

      if (!validPassword) {
        return res.status(401).json({
          message: 'Email hoặc mật khẩu không đúng',
        });
      }

      // ===== CHECK ACTIVATION =====
      if (!user.isActivated) {
        return res.status(403).json({
          message:
            'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.',
        });
      }

      // ===== GENERATE TOKEN =====
      const token = generateToken(user.id);

      logger.info(`User login: ${user.email}`);

      return res.json({
        token,

        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isActivated: user.isActivated,
          theme: user.theme,
          fontFamily: user.fontFamily,
          noteColor: user.noteColor,
          viewMode: user.viewMode,
        },
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

// ======================================================
// ACTIVATE ACCOUNT
// ======================================================
router.get(
  '/activate/:token',
  async (req, res, next) => {
    try {

      const user = await prisma.user.findFirst({
        where: {
          activationToken: req.params.token,
        },
      });

      if (!user) {
        return res.status(400).json({
          message:
            'Link kích hoạt không hợp lệ hoặc đã hết hạn',
        });
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          isActivated: true,
          activationToken: null,
        },
      });

      logger.info(`Account activated: ${user.email}`);

      return res.json({
        message:
          'Tài khoản đã được kích hoạt thành công!',
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

// ======================================================
// RESEND ACTIVATION EMAIL
// ======================================================
router.post(
  '/resend-activation',
  authLimiter,

  async (req, res, next) => {
    try {

      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || user.isActivated) {
        return res.json({
          message:
            'Nếu email tồn tại và chưa kích hoạt, email sẽ được gửi.',
        });
      }

      const activationToken = uuidv4();

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          activationToken,
        },
      });

      await sendActivationEmail(
        user.email,
        user.displayName,
        activationToken
      );

      return res.json({
        message:
          'Email kích hoạt đã được gửi lại.',
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

// ======================================================
// FORGOT PASSWORD
// ======================================================
router.post(
  '/forgot-password',
  authLimiter,

  async (req, res, next) => {
    try {

      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      // ===== SECURITY =====
      // Always return success
      if (user) {

        const resetToken = uuidv4();

        const resetTokenExpiry =
          new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            resetToken,
            resetTokenExpiry,
          },
        });

        sendPasswordResetEmail(
          user.email,
          user.displayName,
          resetToken
        ).catch((err) => {
          logger.error('Reset email failed', err);
        });
      }

      return res.json({
        message:
          'Nếu email tồn tại, link đặt lại mật khẩu sẽ được gửi.',
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

// ======================================================
// RESET PASSWORD
// ======================================================
router.post(
  '/reset-password',

  [
    body('token')
      .notEmpty()
      .withMessage('Token không hợp lệ'),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu tối thiểu 6 ký tự'),

    body('confirmPassword').custom(
      (value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Mật khẩu xác nhận không khớp');
        }

        return true;
      }
    ),
  ],

  async (req, res, next) => {
    try {

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
        });
      }

      const {
        token,
        password,
      } = req.body;

      // ===== FIND USER =====
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return res.status(400).json({
          message:
            'Token không hợp lệ hoặc đã hết hạn',
        });
      }

      // ===== HASH PASSWORD =====
      const passwordHash = await bcrypt.hash(
        password,
        12
      );

      // ===== UPDATE PASSWORD =====
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          passwordHash,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      logger.info(`Password reset: ${user.email}`);

      return res.json({
        message:
          'Mật khẩu đã được đặt lại thành công.',
      });

    } catch (err) {
      logger.error(err);
      next(err);
    }
  }
);

module.exports = router;