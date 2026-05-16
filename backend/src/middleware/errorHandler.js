const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
  });

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ message: 'File quá lớn (tối đa 10MB)' });

  if (err.message === 'Chỉ chấp nhận file ảnh')
    return res.status(400).json({ message: err.message });

  // Prisma errors
  if (err.code === 'P2025')
    return res.status(404).json({ message: 'Không tìm thấy dữ liệu' });

  if (err.code === 'P2002')
    return res.status(409).json({ message: 'Dữ liệu đã tồn tại' });

  // Default
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status === 500 ? 'Lỗi máy chủ nội bộ' : err.message,
  });
}

module.exports = { errorHandler };
