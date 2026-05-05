================================================================================
    HỆ THỐNG NHẮN TIN & GỌI ĐIỆN TRỰC TUYẾN
================================================================================

TRUY CẬP DỰ ÁN
---------------
Trang web: https://peterphan.online

LINK VIDEO DEMO
--------------
Drive: https://drive.google.com/file/d/1lOD6DBqBw0W_FmwXohjS80-n7GpUdlsW/view?usp=drive_link

Youtube: https://youtu.be/oHw2Nac0LG0


================================================================================
CÁCH CHẠY DỰ ÁN VỚI DOCKER
================================================================================

YÊU CẦU
-------
- Docker Engine 20.10+
- Docker Compose 2.0+
- RAM: Tối thiểu 4GB
- Cổng 80 phải trống


BƯỚC 1: Clone dự án
--------------------
git clone https://gitlab.duthu.net/523h0037/fullstack-final.git
cd fullstack-final
git checkout dev


BƯỚC 2: Cấu hình .env
----------------------
cp packages/backend/.env.example packages/backend/.env
nano packages/backend/.env

Các biến BẮT BUỘC:
- MONGODB_URI: MongoDB Atlas connection string
- ACCESS_TOKEN_SECRET: Secret key (tối thiểu 32 ký tự)
- REFRESH_TOKEN_SECRET: Secret key (tối thiểu 32 ký tự)
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET


BƯỚC 3: Khởi chạy
------------------
docker-compose up -d --build

Chờ 30-60 giây để services khởi động


BƯỚC 4: Kiểm tra
-----------------
docker-compose ps

Tất cả services phải có trạng thái "Up"


BƯỚC 5: Truy cập
-----------------
http://localhost


DỪNG ỨNG DỤNG
--------------
docker-compose down              # Giữ lại dữ liệu
docker-compose down -v           # Xóa tất cả dữ liệu


================================================================================
XỬ LÝ LỖI THƯỜNG GẶP
================================================================================

LỖI: Port 80 đã được sử dụng
-----------------------------
# Tìm và kill process
sudo lsof -i :80
sudo kill -9 <PID>


LỖI: Services không khởi động
-------------------------------
docker-compose logs              # Xem logs
docker-compose down -v           # Xóa và rebuild
docker-compose up -d --build


LỖI: MongoDB connection failed
--------------------------------
- Kiểm tra MONGODB_URI trong .env
- Whitelist IP trong MongoDB Atlas: Network Access → 0.0.0.0/0


================================================================================
THÔNG TIN LIÊN HỆ
================================================================================

Sinh viên:
- Phan Huy Phát   - 523H0073
- Bùi Trọng Khang - 523H0037
- Phan Văn Dương  - 523H0017

GitLab: https://gitlab.duthu.net/523h0037/fullstack-final

