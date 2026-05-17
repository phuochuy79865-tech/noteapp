const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;

// ================= CREATE TRANSPORTER =================
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
      tls: {
        rejectUnauthorized: false,
      },
    });

    // ================= VERIFY SMTP =================
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP Error:', error.message);
        logger.error(`SMTP Error: ${error.message}`);
      } else {
        console.log('✅ SMTP Server Ready');
        logger.info('SMTP Server Ready');
      }
    });
  }

  return transporter;
}

// ================= EMAIL TEMPLATE STYLE =================
const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
`;

function emailWrapper(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>

<body style="margin:0;padding:20px;background:#f1f5f9;">

  <div style="${baseStyle}">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">
        📝 NoteApp
      </h1>
    </div>

    <!-- Content -->
    <div style="padding:32px;background:white;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="padding:16px;text-align:center;background:#f8fafc;color:#94a3b8;font-size:12px;">
      © ${new Date().getFullYear()} NoteApp.
      Email này được gửi tự động, vui lòng không trả lời.
    </div>

  </div>

</body>
</html>
`;
}

// ================= BUTTON COMPONENT =================
const btn = (url, text) => `
<a
  href="${url}"
  style="
    display:inline-block;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    color:white;
    padding:14px 28px;
    border-radius:8px;
    text-decoration:none;
    font-weight:600;
    margin:24px 0;
  "
>
  ${text}
</a>
`;

// ================= SEND EMAIL FUNCTION =================
async function sendMail(to, subject, html) {
  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to}`);
    console.log(`📧 Email sent to ${to}`);

    return info;
  } catch (error) {
    logger.error(`Send email error: ${error.message}`);
    console.error('❌ Send Email Error:', error.message);

    throw error;
  }
}

// ================= ACTIVATION EMAIL =================
async function sendActivationEmail(email, displayName, token) {
  const link = `${process.env.APP_URL}/activate?token=${token}`;

  const html = emailWrapper(
    'Kích hoạt tài khoản NoteApp',
    `
    <h2 style="color:#1e293b;margin-top:0;">
      Xin chào, ${displayName}! 👋
    </h2>

    <p style="color:#475569;line-height:1.6;">
      Cảm ơn bạn đã đăng ký <strong>NoteApp</strong>.
      Nhấn nút bên dưới để kích hoạt tài khoản:
    </p>

    <div style="text-align:center;">
      ${btn(link, '✅ Kích hoạt tài khoản')}
    </div>

    <p style="color:#94a3b8;font-size:13px;">
      Link có hiệu lực trong 24 giờ.
      Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

    <p style="color:#94a3b8;font-size:12px;">
      Hoặc copy link:
      <a href="${link}" style="color:#6366f1;">
        ${link}
      </a>
    </p>
    `
  );

  return sendMail(
    email,
    '✅ Kích hoạt tài khoản NoteApp',
    html
  );
}

// ================= PASSWORD RESET EMAIL =================
async function sendPasswordResetEmail(email, displayName, token) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;

  const html = emailWrapper(
    'Đặt lại mật khẩu NoteApp',
    `
    <h2 style="color:#1e293b;margin-top:0;">
      Quên mật khẩu? 🔐
    </h2>

    <p style="color:#475569;line-height:1.6;">
      Xin chào <strong>${displayName}</strong>,
      chúng tôi nhận được yêu cầu đặt lại mật khẩu.
    </p>

    <div style="text-align:center;">
      ${btn(link, '🔑 Đặt lại mật khẩu')}
    </div>

    <p style="color:#94a3b8;font-size:13px;">
      Link có hiệu lực trong <strong>1 giờ</strong>.
      Nếu bạn không yêu cầu, hãy bỏ qua email này.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

    <p style="color:#94a3b8;font-size:12px;">
      Hoặc copy link:
      <a href="${link}" style="color:#6366f1;">
        ${link}
      </a>
    </p>
    `
  );

  return sendMail(
    email,
    '🔑 Đặt lại mật khẩu NoteApp',
    html
  );
}

// ================= SHARE NOTE EMAIL =================
async function sendShareEmail(email, displayName, noteTitle, permission) {
  const link = `${process.env.APP_URL}/notes`;

  const permText =
    permission === 'edit'
      ? 'Có thể chỉnh sửa'
      : 'Chỉ xem';

  const html = emailWrapper(
    'Ghi chú được chia sẻ',
    `
    <h2 style="color:#1e293b;margin-top:0;">
      📤 Có ghi chú mới được chia sẻ!
    </h2>

    <p style="color:#475569;line-height:1.6;">
      Xin chào <strong>${displayName}</strong>,
      bạn vừa được chia sẻ một ghi chú:
    </p>

    <div
      style="
        background:#f8fafc;
        border-left:4px solid #6366f1;
        padding:16px;
        border-radius:0 8px 8px 0;
        margin:16px 0;
      "
    >
      <p style="margin:0;font-weight:600;color:#1e293b;">
        "${noteTitle}"
      </p>

      <p style="margin:4px 0 0;color:#6366f1;font-size:14px;">
        Quyền: ${permText}
      </p>
    </div>

    <div style="text-align:center;">
      ${btn(link, '📝 Xem ghi chú')}
    </div>
    `
  );

  return sendMail(
    email,
    '📤 Có ghi chú được chia sẻ với bạn',
    html
  );
}

module.exports = {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendShareEmail,
};