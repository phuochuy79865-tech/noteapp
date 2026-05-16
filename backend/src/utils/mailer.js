const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
`;

function emailWrapper(title, content) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:20px;background:#f1f5f9;">
  <div style="${baseStyle}">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">📝 NoteApp</h1>
    </div>
    <div style="padding:32px;background:white;">
      ${content}
    </div>
    <div style="padding:16px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">
      © ${new Date().getFullYear()} NoteApp. Email này được gửi tự động, vui lòng không trả lời.
    </div>
  </div>
</body>
</html>`;
}

const btn = (url, text) =>
  `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">${text}</a>`;

// ── Activation email ──────────────────────────────────────────────────
async function sendActivationEmail(email, displayName, token) {
  const link = `${process.env.APP_URL}/activate?token=${token}`;
  const html = emailWrapper(
    'Kích hoạt tài khoản NoteApp',
    `
    <h2 style="color:#1e293b;margin-top:0;">Xin chào, ${displayName}! 👋</h2>
    <p style="color:#475569;line-height:1.6;">
      Cảm ơn bạn đã đăng ký <strong>NoteApp</strong>. Nhấn nút bên dưới để kích hoạt tài khoản của bạn:
    </p>
    <div style="text-align:center;">${btn(link, '✅ Kích hoạt tài khoản')}</div>
    <p style="color:#94a3b8;font-size:13px;">Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, hãy bỏ qua email này.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="color:#94a3b8;font-size:12px;">Hoặc copy link: <a href="${link}" style="color:#6366f1;">${link}</a></p>
    `
  );

  return getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: '✅ Kích hoạt tài khoản NoteApp của bạn',
    html,
  });
}

// ── Password reset email ──────────────────────────────────────────────
async function sendPasswordResetEmail(email, displayName, token) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;
  const html = emailWrapper(
    'Đặt lại mật khẩu NoteApp',
    `
    <h2 style="color:#1e293b;margin-top:0;">Quên mật khẩu? 🔐</h2>
    <p style="color:#475569;line-height:1.6;">
      Xin chào <strong>${displayName}</strong>, chúng tôi nhận được yêu cầu đặt lại mật khẩu.
    </p>
    <div style="text-align:center;">${btn(link, '🔑 Đặt lại mật khẩu')}</div>
    <p style="color:#94a3b8;font-size:13px;">Link có hiệu lực trong <strong>1 giờ</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="color:#94a3b8;font-size:12px;">Hoặc copy link: <a href="${link}" style="color:#6366f1;">${link}</a></p>
    `
  );

  return getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: '🔑 Đặt lại mật khẩu NoteApp',
    html,
  });
}

// ── Share notification email ──────────────────────────────────────────
async function sendShareEmail(email, displayName, noteTitle, permission) {
  const link = `${process.env.APP_URL}/notes`;
  const permText = permission === 'edit' ? 'chỉnh sửa' : 'chỉ xem';
  const html = emailWrapper(
    'Ghi chú được chia sẻ với bạn',
    `
    <h2 style="color:#1e293b;margin-top:0;">📤 Ghi chú mới được chia sẻ!</h2>
    <p style="color:#475569;line-height:1.6;">
      Xin chào <strong>${displayName}</strong>, một người dùng đã chia sẻ ghi chú với bạn:
    </p>
    <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#1e293b;">"${noteTitle}"</p>
      <p style="margin:4px 0 0;color:#6366f1;font-size:14px;">Quyền: ${permText}</p>
    </div>
    <div style="text-align:center;">${btn(link, '📝 Xem ghi chú')}</div>
    `
  );

  return getTransporter().sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: '📤 Có ghi chú mới được chia sẻ với bạn',
    html,
  });
}

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendShareEmail };
