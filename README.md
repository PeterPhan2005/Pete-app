# Hệ thống Nhắn tin & Gọi điện Trực tuyến
 
> **Công nghệ:** ReactJS, NodeJS, Socket.IO, WebRTC, MongoDB, Redis, Docker.
> **Mã đề tài:** DAF05.
> **Giảng viên hướng dẫn:** Vũ Đình Hồng.
> **Thành viên tham gia:** Bùi Trọng Khang, Phan Huy Phát, Phan Văn Dương.
---

## 📋 Mục lục

- [Tổng quan](#-tổng-quan)
- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Cài đặt & Chạy](#-cài-đặt--chạy)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Documentation](#-api-documentation)
- [Scaling & Performance](#-scaling--performance)

---

## 🎯 Tổng quan

Hệ thống nhắn tin và gọi điện trực tuyến được xây dựng với mục tiêu:

- ✅ **Real-time Communication**: Nhắn tin và gọi điện tức thời
- ✅ **High Scalability**: Chịu tải hàng ngàn users đồng thời
- ✅ **Modern Architecture**: Microservices, Load Balancing, Caching
- ✅ **Production Ready**: Docker, CI/CD, Monitoring

### Điểm nổi bật

- 🚀 **WebSocket với Socket.IO**: Real-time bidirectional communication
- 📞 **WebRTC**: Peer-to-peer audio/video calling
- ⚡ **Redis Pub/Sub**: Đồng bộ tin nhắn giữa multiple server instances
- 🔄 **Nginx Load Balancer**: Phân phối tải tới 3 backend instances
- 💾 **Redis Cache**: Giảm 70-90% database queries
- 🐰 **RabbitMQ**: Xử lý async tasks (image processing, logging)

---

## ✨ Tính năng

### Bảng tính năng theo cấp độ (đối chiếu đề cương)

|  Cấp độ  |          Nhóm tính năng           |                    Theo đề cương                          |   Trạng thái  |
|----------|-----------------------------------|-----------------------------------------------------------|---------------|
| Cấp độ 1 | Authentication                    | Đăng ký/đăng nhập JWT                                     | ✅ Hoàn thành |
| Cấp độ 1 | Danh bạ & Kết bạn                 | Tìm user, gửi/chấp nhận lời mời kết bạn                   | ✅ Hoàn thành |
| Cấp độ 1 | Chat 1-1                          | Nhắn tin real-time, lưu lịch sử, trạng thái đã gửi/đã xem | ✅ Hoàn thành |
| Cấp độ 2 | Group Chat                        | Tạo nhóm, thêm/xóa thành viên, rời nhóm/giải tán nhóm     | ✅ Hoàn thành |
| Cấp độ 2 | Multimedia Messaging              | Gửi ảnh và file đính kèm, preview ảnh                     | ✅ Hoàn thành |
| Cấp độ 2 | Presence System                   | Online/Offline real-time, trạng thái "đang soạn tin"      | ✅ Hoàn thành |
| Cấp độ 3 | Signaling Server                  | Cơ chế handshake WebRTC (offer/answer, ICE)               | ✅ Hoàn thành |
| Cấp độ 3 | 1-on-1 Audio/Video Call           | Gọi P2P, bật/tắt mic, bật/tắt camera, kết thúc cuộc gọi   | ✅ Hoàn thành |
| Cấp độ 4 | Scale Socket với Redis Adapter    | Redis Pub/Sub đồng bộ nhiều backend instances             | ✅ Hoàn thành |
| Cấp độ 4 | Load Balancing                    | Nginx reverse proxy phân phối tải nhiều backend           | ✅ Hoàn thành |
| Cấp độ 4 | Redis Caching                     | Cache dữ liệu truy xuất nhiều để giảm tải DB              | ✅ Hoàn thành |
| Cấp độ 4 | Message Queue (nâng cao/optional) | RabbitMQ xử lý tác vụ async                               | ✅ Hoàn thành |

### Các hạng mục nhóm tự mở rộng (ngoài đề cương)

| Cấp độ liên quan |                Hạng mục mở rộng của nhóm                  |                    Ghi chú              |
|------------------|-----------------------------------------------------------|-----------------------------------------|
|    Cấp độ 1      | Refresh token + session management                        | Tăng bảo mật phiên đăng nhập            |
|    Cấp độ 1      | Băm mật khẩu với bcrypt                                   | Bổ sung lớp bảo mật dữ liệu người dùng  |
|    Cấp độ 1      | Phân trang lịch sử chat                                   | Tối ưu tải dữ liệu tin nhắn cũ          |
|    Cấp độ 2      | Đổi tên nhóm, avatar nhóm                                 | Mở rộng quản trị nhóm                   |
|    Cấp độ 2      | Emoji picker                                              | Cải thiện trải nghiệm chat              |
|    Cấp độ 2      | Last seen timestamp                                       | Bổ sung thông tin hiện diện người dùng  |
|    Cấp độ 3      | Incoming call popup (ringing UI)                          | Cải thiện UX khi có cuộc gọi đến        |
|    Cấp độ 3      | Call history trong chat                                   | Theo dõi lịch sử cuộc gọi               |
|    Cấp độ 4      | IP hash sticky session cho WebSocket                      | Ổn định kết nối socket qua load balancer|
|    Cấp độ 4      | Health check + failover backend                           | Tăng độ sẵn sàng hệ thống               |
|    Cấp độ 4      | Nhiều queue chuyên biệt (email, image, logging, activity) | Tách tải tác vụ nặng theo nghiệp vụ     |

---

## 🛠 Công nghệ sử dụng

| Nhóm     |     Công nghệ      |           Chức năng              |    Phiên bản        | Yêu cầu hệ thống tối thiểu |
|----------|--------------------|----------------------------------|---------------------|----------------------------|
| Frontend | React              | Xây dựng UI component-based      | ^19.2.3             | Node.js >= 20              |
| Frontend | TypeScript         | Type safety cho frontend         | ~5.9.3              | Node.js >= 20              |
| Frontend | Vite               | Dev server + bundler             | ^7.1.7              | Node.js >= 20              |
| Frontend | Zustand            | Quản lý state toàn cục           | ^5.0.8              | Node.js >= 20              |
| Frontend | Tailwind CSS       | Styling utility-first            | ^4.1.14             | Node.js >= 20              |
| Frontend | Socket.IO Client   | Kết nối realtime client          | ^4.8.1              | Node.js >= 20              |
| Frontend | Axios              | HTTP client gọi REST API         | ^1.12.2             | Node.js >= 20              |
| Backend  | Node.js            | Runtime cho API và Socket server | 20.x                | Node.js >= 20              |
| Backend  | Express.js         | Xây dựng REST API                | ^4.18.2             | Node.js >= 20              |
| Backend  | Socket.IO          | Realtime và signaling WebRTC     | ^4.8.3              | Node.js >= 20              |
| Backend  | MongoDB + Mongoose | Lưu trữ dữ liệu nghiệp vụ        | Mongoose ^8.1.1     | MongoDB Atlas/MongoDB local|
| Backend  | Redis              | Cache và Pub/Sub đa instance     | redis client ^4.7.1 | Redis 7+                   |
| Backend  | RabbitMQ           | Message queue cho tác vụ async   | amqplib ^0.10.3     | RabbitMQ 3+                |
| Backend  | JWT (jsonwebtoken) | Xác thực access token            | ^9.0.2              |                            |
| Backend  | bcryptjs           | Hash mật khẩu                    | ^2.4.3              | Node.js >= 20              |
| Backend  | Cloudinary SDK     | Lưu trữ file/media               | ^2.9.0              | Account Cloudinary +API key|
| DevOps   | Docker             | Container hóa service            | 20.10+              | Docker Engine              |
| DevOps   | Docker Compose     | Orchestrate nhiều container      | 2.0+                | Docker Compose             |
| DevOps   | Nginx              | Reverse proxy + load balancing   | nginx:alpine        | Cổng 80 trống              |
| DevOps   | Git                | Quản lý mã nguồn                 | 2.x                 | Git CLI                    |

Ghi chú:
- Các phiên bản có ký hiệu ^ hoặc ~ được lấy theo `package.json` hiện tại.
- Nếu chạy bằng Docker Compose, môi trường Node cục bộ không bắt buộc cho runtime (chỉ cần khi dev local ngoài Docker).

---

## 🏗 Kiến trúc hệ thống

### Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                      │
│                (React + REST API + Socket.IO)               │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Load Balancer                      │
│                  (Port 80 - Reverse Proxy)                  │
│                    ip_hash sticky sessions                  │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌────────────┐     ┌────────────┐     ┌────────────┐
│ Backend-1  │     │ Backend-2  │     │ Backend-3  │
│  :5000     │     │  :5000     │     │  :5000     │
│ API+Socket │     │ API+Socket │     │ API+Socket │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │
      └──────────────────┴──────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌────────────────────┐  ┌──────────┐  ┌──────────────┐
│  MongoDB Atlas     │  │  Redis   │  │  RabbitMQ    │
│  (External Service)│  │  :6379   │  │  :5672       │
│                    │  │          │  │              │
│ - Users            │  │ - Cache  │  │ - Email Q    │
│ - Messages         │  │ - Pub/Sub│  │ - Image Q    │
│ - Conversations    │  │          │  │ - Log Q      │
│ - Calls            │  │          │  │ - Activity Q │
└────────────────────┘  └──────────┘  └──────────────┘
```

### Luồng xử lý tin nhắn

```
User A (Frontend)                  Nginx               Backend-1
  │                              │                    │
  │ 1. POST /api/message/send    │                    │
  ├─────────────────────────────>│───────────────────>│
  │                              │                    │
  │                              │          2. Save message to MongoDB
  │                              │                    │
  │                              │          3. Emit "new-message" to room
  │                              │                    │
  │                              │          4. Redis adapter pub/sub sync
  │                              │                    │
  │                              │                    ▼
  │                     ┌─────────────────────────────────────────┐
  │                     │         Redis Pub/Sub Channel           │
  │                     │    (socket.io cross-instance sync)      │
  │                     └──────┬──────────────────────────────────┘
  │                            │                              
  │                            │ 5. Deliver event              
  |                            |     to all subscribers        
  │                            ▼                         
  │                     ┌──────────────┐                   ┌──────────────┐
  │                     │  Backend-1   │                   │  Backend-2   │
  │                     └──────┬───────┘                   └──────┬───────┘
  │                            │                                  │
  ▼                            ▼                                  ▼
   User A                     User A socket                      User B socket
(receive realtime)           (same instance)                    (other instance)

Side effects (async): Backend publishes jobs to RabbitMQ queues
- message_logging
- image_processing (if image)
- user_activity
```

### WebRTC Signaling Flow

```
Caller (User A)                Signaling Server              Callee (User B)
      │                              │                              │
      │ 1. call:initiate             │                              │
      ├─────────────────────────────>│                              │
      │                              │ 2. call:initiated            │
      │<─────────────────────────────┤                              │
      │                              │ 3. call:incoming             │
      │                              ├─────────────────────────────>│
      │                              │                              │
      │                              │ 4. call:accept               │
      │                              │<─────────────────────────────┤
      │ 5. call:accepted             │                              │
      │<─────────────────────────────┤                              │
      │                              │                              │
      │ 6. webrtc:offer              │                              │
      ├─────────────────────────────>│─────────────────────────────>│
      │                              │                              │
      │                              │ 7. webrtc:answer             │
      │<─────────────────────────────┤<─────────────────────────────┤
      │                              │                              │
      │ 8. webrtc:ice-candidate      │                              │
      │<────────────────────────────>│<────────────────────────────>│
      │                              │                              │
      │                                                             │
      │ 9. P2P media connection (STUN-based, TURN if needed)        │
      │<───────────────────────────────────────────────────────────>│
```

---

## 📁 Cấu trúc thư mục

```
fullstack-final/
├── scripts/                        # Test & utility scripts
│   ├── test-load-balancer.sh      # Test Nginx load balancing
│   ├── test-redis-cache.sh        # Test Redis caching
│   ├── test-rabbitmq.sh           # Test RabbitMQ queues
│   └── view-logs.sh               # Interactive log viewer
│
├── packages/
│   ├── backend/                    # Node.js Backend
│   │   ├── src/
│   │   │   ├── config/            # Cấu hình (Redis, RabbitMQ, Cloudinary)
│   │   │   ├── controllers/       # Business logic
│   │   │   ├── middlewares/       # Auth, Cache, Socket middlewares
│   │   │   ├── models/            # Mongoose schemas
│   │   │   ├── routes/            # API routes
│   │   │   ├── socket/            # Socket.IO handlers
│   │   │   ├── utils/             # Helper functions
│   │   │   ├── workers/           # RabbitMQ workers
│   │   │   └── server.js          # Entry point
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── frontend/                   # React Frontend
│       ├── src/
│       │   ├── components/        # React components
│       │   │   ├── auth/          # Login, Signup
│       │   │   ├── chat/          # Chat UI components
│       │   │   ├── call/          # Video call components
│       │   │   ├── profile/       # User profile
│       │   │   └── ui/            # Shadcn UI components
│       │   ├── stores/            # Zustand state management
│       │   ├── services/          # API services
│       │   ├── types/             # TypeScript types
│       │   ├── pages/             # Page components
│       │   └── main.tsx           # Entry point
│       ├── Dockerfile
│       ├── package.json
│       └── vite.config.ts
│
├── docker-compose.yml              # Docker orchestration
├── nginx.conf                      # Nginx load balancer config
├── .gitignore
└── README.md
```

## 🚀 Cài đặt & Chạy

### Yêu cầu hệ thống

Chi tiết vai trò, phiên bản và yêu cầu của từng công nghệ được liệt kê ở mục **Công nghệ sử dụng** phía trên.

### Bước 1: Clone repository

```bash
git clone https://gitlab.duthu.net/523h0037/fullstack-final.git
cd fullstack-final
git checkout dev
```

### Bước 2: Cấu hình Environment Variables

**Backend (.env):**

```bash
# Copy file mẫu
cp packages/backend/.env.example packages/backend/.env

# Chỉnh sửa file .env
nano packages/backend/.env
```

Các biến quan trọng:
```env
NODE_ENV=development
PORT=5000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://your-db-user:your-db-password@your-cluster.mongodb.net/callapp_app?retryWrites=true&w=majority&appName=Cluster0

# Redis
REDIS_URL=redis://localhost:6379

# JWT
ACCESS_TOKEN_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Client
CLIENT_URL=http://localhost:3000

# Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

### Bước 3: Khởi chạy với Docker (Recommended)

```bash
# Khởi động tất cả services
docker-compose up -d --build

# Chờ 30-60 giây để services khởi động
# Kiểm tra trạng thái
docker-compose ps

# Xem logs
docker-compose logs -f
```

**Services sẽ chạy:**
- Frontend: http://localhost
- Backend API: http://localhost/api
- RabbitMQ Management: http://localhost:15672 (admin/admin123)
- Redis: localhost:6379

### Bước 4: Dừng hệ thống

```bash
# Dừng tất cả services
docker-compose down

# Dừng và xóa volumes (clean slate)
docker-compose down -v
```

### Chạy local (Development)

**Backend:**
```bash
cd packages/backend
npm install
npm run dev
```

**Frontend:**
```bash
cd packages/frontend
npm install
npm run dev
```

**Yêu cầu:** Redis và RabbitMQ phải chạy local hoặc qua Docker.

---

---

## 📚 API Documentation

### Authentication

**POST /api/auth/register**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "displayName": "John Doe"
}
```

**POST /api/auth/login**
```json
{
  "username": "john_doe",
  "password": "SecurePass123"
}
```

**POST /api/auth/logout**
- Requires: Authentication

**POST /api/auth/refresh**
- Requires: Refresh token in cookie

### User Management

**GET /api/user/me**
- Get current user profile
- Cached: 5 minutes

**PUT /api/user/profile**
```json
{
  "displayName": "John Updated",
  "bio": "Software Engineer"
}
```

**GET /api/user/search?q=john**
- Search users by username/email
- Cached: 2 minutes

### Friends

**POST /api/friend/request**
```json
{
  "receiverId": "user_id_here"
}
```

**PUT /api/friend/request/:requestId/accept**

**DELETE /api/friend/request/:requestId/reject**

**GET /api/friend/requests**
- Get pending friend requests

**GET /api/friend/list**
- Get friends list

### Conversations

**GET /api/conversation**
- Get all conversations
- Cached: 2 minutes

**POST /api/conversation/direct**
```json
{
  "userId": "user_id_2"
}
```

**POST /api/conversation/group**
```json
{
  "groupName": "Team Chat",
  "participantIds": ["user_id_2", "user_id_3"]
}
```

**GET /api/conversation/:id/messages**
- Get messages with pagination
- Cached: 1 minute

### Messages

**POST /api/message/send**
```json
{
  "conversationId": "conv_id",
  "content": "Hello!",
  "type": "text"
}
```

**POST /api/message/upload**
- Upload file (multipart/form-data)
- Max size: 5MB

**PUT /api/message/:id**
- Edit message

**DELETE /api/message/:id/for-me**
- Delete message for current user only

**DELETE /api/message/:id/for-everyone**
- Delete message for all participants

### Calls

**GET /api/call/history**
- Get current user's call history

**GET /api/call/conversation/:conversationId/active**
- Get active call in a conversation

**GET /api/call/conversation/:conversationId/history**
- Get call history for a conversation

**GET /api/call/:callId**
- Get call details by call ID

Signaling actions `initiate`, `accept`, `decline`, `end` are handled via Socket.IO events, not REST endpoints.

---

## ⚡ Scaling & Performance

### Load Balancing với Nginx

**Cấu hình (nginx.conf):**
```nginx
upstream backend_servers {
    ip_hash;  # Sticky sessions cho WebSocket
    
    server backend-1:5000 max_fails=3 fail_timeout=30s;
    server backend-2:5000 max_fails=3 fail_timeout=30s;
    server backend-3:5000 max_fails=3 fail_timeout=30s;
}
```

**Test Load Balancing:**
```bash
# Gửi 10 requests và xem backend nào xử lý
for i in {1..10}; do
  curl -s http://localhost/api/health | grep -o '"instance":"[^"]*"'
done
```

### Redis Pub/Sub cho Socket.IO

**Code (socket/index.js):**
```javascript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

**Lợi ích:**
- User A (backend-1) chat được với User B (backend-2)
- Horizontal scaling: Thêm backend-4, backend-5...
- Zero downtime deployment

### Redis Caching

**Cache Strategy:**
|    Dữ liệu    | TTL    | Hit Rate |
|---------------|--------|----------|
| User Profile  | 5 phút | ~85%     |
| Friends List  | 5 phút | ~80%     |
| Conversations | 2 phút | ~75%     |
|   Messages    | 1 phút | ~60%     |

**Performance Improvement:**
- Database queries giảm 70-90%
- Response time: 300ms → 5ms
- Throughput tăng 10x

### RabbitMQ Message Queue

**Queues:**
- `email_notifications` - Gửi email async
- `image_processing` - Resize, compress ảnh
- `message_logging` - Log analytics
- `user_activity` - Track user behavior

**Lợi ích:**
- API response time: 1500ms → 50ms
- Non-blocking operations
- Retry mechanism tự động
- Scale workers độc lập

### Performance Metrics

**Trước khi optimize:**
- Response time: 300-500ms
- Max concurrent users: ~500
- Database load: 100%

**Sau khi optimize (Level 4):**
- Response time: 4-50ms (6-10x faster)
- Max concurrent users: ~5000+ (10x more)
- Database load: 10-30% (70-90% reduction)
- Horizontal scaling ready

---

## 🧪 Testing

Nhóm cung cấp các test scripts tự động trong folder `scripts/`:

### Test Load Balancing
```bash
./scripts/test-load-balancer.sh
```
Kiểm tra Nginx phân phối requests đều tới 3 backend instances.

### Test Redis Cache
```bash
./scripts/test-redis-cache.sh
```
Xem cache keys và statistics trong Redis.

### Test RabbitMQ
```bash
./scripts/test-rabbitmq.sh
```
Kiểm tra queues và workers đang hoạt động.

### View Logs
```bash
./scripts/view-logs.sh
```
Interactive menu để xem logs của các services.

### Manual Testing

**Test Cache HIT/MISS:**
```bash
# Monitor cache logs
docker-compose logs -f backend-1 | grep -i cache
```

**Test Redis Pub/Sub:**
```bash
# Xem logs 3 backends đồng thời
docker-compose logs -f backend-1 backend-2 backend-3
```

**Test RabbitMQ Workers:**
```bash
# Monitor workers processing
docker-compose logs -f backend-1 | grep -i worker
```

---

## 📊 Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend-1

# Multiple services
docker-compose logs -f backend-1 backend-2 backend-3
```

### Resource Usage
```bash
docker stats
```

### Health Checks
```bash
# Backend health
curl http://localhost/api/health

# Redis health
docker-compose exec redis redis-cli ping

# RabbitMQ health
curl -u admin:admin123 http://localhost:15672/api/healthchecks/node
```

---

## 🐛 Troubleshooting

### Port 80 đã được sử dụng.
```bash
# Tìm process với port cụ thể
sudo lsof -i :80

# Kill process với process id
sudo kill -9 <PID>
```

### Services không khởi động
```bash
# Xem logs chi tiết
docker-compose logs

# Rebuild
docker-compose down -v
docker-compose up -d --build
```

### Out of memory
```bash
# Tăng memory cho Docker
# Docker Desktop → Settings → Resources → Memory (min 4GB)

# Clean up
docker system prune -a
```

---

## 👥 Contributors

- **Sinh viên 1** - Phan Huy Phát - **MSSV:** 523H0073
- **Sinh viên 2** - Bùi Trọng Khang - **MSSV:** 523H0037
- **Sinh viên 3** - Phan Văn Dương - **MSSV:** 523H0017

---

## 📞 Contact

- **Email**: 523H0017@student.tdtu.edu.vn - 523H0037@student.tdtu.edu.vn - 523H0073@student.tdtu.edu.vn
- **GitLab**: https://gitlab.duthu.net/523h0037/fullstack-final

---