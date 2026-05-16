# 📝 NoteApp - Full-Stack Note Taking Application

## Tính năng

### 👤 Quản lý tài khoản
- Đăng ký / Đăng nhập với Email + Mật khẩu
- Mật khẩu băm bằng **bcrypt** (cost factor 12)
- Kích hoạt tài khoản qua Email (link)
- Quên mật khẩu qua Email (link, hết hạn 1 giờ)
- Chỉnh sửa Profile: Avatar, Tên hiển thị
- Cá nhân hóa: Font, màu ghi chú, theme Sáng/Tối

### 📒 Ghi chú cơ bản
- Giao diện Grid / List
- Auto-save (500ms debounce)
- Đính kèm nhiều ảnh (tự động nén WebP)
- Ghim ghi chú lên đầu
- Live search (300ms debounce)
- Nhãn (Labels): tạo/sửa/xóa, nhiều nhãn/ghi chú

### 🔐 Ghi chú nâng cao
- Khóa ghi chú bằng mật khẩu riêng (bcrypt)
- Chia sẻ qua email: quyền "Chỉ xem" / "Được sửa"
- **Cộng tác thời gian thực** bằng WebSocket (Socket.IO)
- Icon nhận diện: ghim 📌, khóa 🔒, chia sẻ 👥

### 🌐 Kỹ thuật
- **PWA** + Service Worker (offline support)
- **Docker Compose** deployment
- **Rate limiting** chống brute force
- **JWT** authentication
- URL tương đối, không hardcode port/hostname

---

## 🚀 Cách chạy

### Yêu cầu
- Docker & Docker Compose
- Tài khoản SMTP (Gmail, Mailgun, ...)

### Bước 1: Cấu hình
```bash
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn
nano .env
```

### Bước 2: Chạy với Docker Compose
```bash
docker-compose up -d
```

Ứng dụng sẽ chạy tại: **http://localhost**

### Bước 3: Kiểm tra
```bash
# Xem logs
docker-compose logs -f backend

# Kiểm tra health
curl http://localhost/api/health
```

---

## 📁 Cấu trúc dự án

```
noteapp/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf              # Reverse proxy + WebSocket
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # SQL migrations
│   └── src/
│       ├── index.js            # Express server + Socket.IO
│       ├── socket.js           # WebSocket real-time handler
│       ├── routes/
│       │   ├── auth.js         # Đăng ký/Đăng nhập/Reset
│       │   ├── notes.js        # CRUD + Lock + Share
│       │   ├── labels.js       # Nhãn
│       │   ├── users.js        # Profile/Preferences
│       │   └── uploads.js      # Ảnh upload
│       ├── middleware/
│       │   ├── authenticate.js # JWT verification
│       │   ├── rateLimiter.js  # Rate limiting
│       │   └── errorHandler.js # Global error handler
│       └── utils/
│           ├── mailer.js       # Nodemailer + Email templates
│           └── logger.js       # Winston logger
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js          # Vite + PWA config
    └── src/                    # React app
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/auth/activate/:token` | Kích hoạt tài khoản |
| POST | `/api/auth/forgot-password` | Yêu cầu reset mật khẩu |
| POST | `/api/auth/reset-password` | Đặt lại mật khẩu |

### Notes (cần JWT)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/notes` | Danh sách (hỗ trợ ?search=&labelId=) |
| POST | `/api/notes` | Tạo ghi chú |
| GET | `/api/notes/:id` | Chi tiết |
| PATCH | `/api/notes/:id` | Cập nhật (auto-save) |
| DELETE | `/api/notes/:id` | Xóa |
| POST | `/api/notes/:id/lock` | Đặt mật khẩu |
| POST | `/api/notes/:id/unlock` | Mở khóa (verify pw) |
| DELETE | `/api/notes/:id/lock` | Gỡ mật khẩu |
| POST | `/api/notes/:id/share` | Chia sẻ |
| DELETE | `/api/notes/:id/share/:shareId` | Hủy chia sẻ |

### WebSocket Events
| Event | Hướng | Mô tả |
|-------|-------|-------|
| `note:join` | Client → Server | Vào phòng cộng tác |
| `note:leave` | Client → Server | Rời phòng |
| `note:change` | Client → Server | Thay đổi nội dung |
| `note:changed` | Server → Client | Broadcast thay đổi |
| `note:collaborators` | Server → Client | Danh sách người đang sửa |
| `note:cursor` | Client → Server | Vị trí con trỏ |

---

## 🔒 Bảo mật

- Mật khẩu người dùng: **bcrypt** cost 12
- Mật khẩu ghi chú: **bcrypt** cost 10
- JWT token hết hạn 7 ngày
- Rate limiting: 10 lần/15 phút cho auth, 200 lần/15 phút cho API
- Helmet.js security headers
- Input validation với express-validator
- SQL injection prevention qua Prisma ORM

---

## 📧 Cấu hình Gmail SMTP

1. Bật 2-Step Verification trong Google Account
2. Tạo App Password: Google Account → Security → App passwords
3. Điền vào `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # App password
```
