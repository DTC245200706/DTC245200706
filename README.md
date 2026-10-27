# Đề tài: Hệ Thống Đặt Vé Sự Kiện (Event Management System)
Môn: Triển khai và Quản trị Hệ thống Phần mềm

## 1. Thành phần hệ thống
- **Web App**: Quản lý đặt vé sự kiện
- **Database**: PostgreSQL 
- **Công cụ quản trị DB**: pgAdmin 4
- **Reverse Proxy**: Nginx (Cấu hình Security Headers)
- **Monitoring**: Prometheus + Grafana + Node Exporter + cAdvisor
- **Centralized Logging**: Grafana Loki + Promtail (Truy vấn LogQL)

## 2. Hướng dẫn khởi chạy
1. Khởi chạy toàn bộ hệ thống bằng Docker Compose:
   ```bash
   docker compose up -d
## 3. Kiểm tra và Truy cập Hệ thống
Sau khi container đã chạy ổn định, có thể truy cập các service qua các cổng cấu hình sau:

- **Web App (Event Management)**: `http://localhost:80` (hoặc cổng cấu hình trong Nginx)
- **pgAdmin 4**: `http://localhost:5050` (dùng để quản trị cơ sở dữ liệu PostgreSQL)
- **Prometheus**: `http://localhost:9090` (theo dõi metrics hệ thống)
- **Grafana Dashboard**: `http://localhost:3000` (xem biểu đồ giám sát và truy vấn LogQL từ Loki)

## 4. Dừng hệ thống
Khi không dùng nữa hoặc cần build lại, cứ gõ lệnh huyền thoại này ở đất terminal:
```bash
docker compose down
