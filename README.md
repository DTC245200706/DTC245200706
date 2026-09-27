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
