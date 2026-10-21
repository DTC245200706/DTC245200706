# Hệ thống đặt vé sự kiện – Docker Compose

**Mã số sinh viên:** DTC245200706
**Môn học:** Triển khai và Quản trị Hệ thống Phần mềm
**Repository:** https://github.com/Dvihndg/DTC245200706

## 1. Giới thiệu

Đây là hệ thống đặt vé sự kiện được triển khai bằng Docker Compose. Hệ thống gồm ứng dụng web Node.js/Express, PostgreSQL, pgAdmin 4, Nginx Reverse Proxy, Prometheus, Grafana, Node Exporter, Loki và Promtail.

Mục tiêu của dự án:

- Đóng gói ứng dụng, cơ sở dữ liệu và các công cụ vận hành bằng Docker Compose.
- Sử dụng Nginx làm điểm truy cập chính và reverse proxy đến ứng dụng.
- Thu thập metrics bằng Prometheus và hiển thị trên Grafana.
- Tập trung log container bằng Promtail và Loki, truy vấn bằng LogQL.
- Quản lý mã nguồn và cấu hình trên GitHub theo các mốc commit có ý nghĩa.

> **Lưu ý về phạm vi hiện tại:** cấu hình hiện tại đã có Node Exporter và metrics của ứng dụng. Repository chưa khai báo service cAdvisor trong `docker-compose.yml`; vì vậy không nên ghi cAdvisor là thành phần đã triển khai cho đến khi bổ sung service và target tương ứng.

## 2. Kiến trúc hệ thống

```text
                         Người dùng / Quản trị viên
                                   |
                    +--------------+--------------+
                    |                             |
              Nginx :80                         Các cổng quản trị
                    |                       pgAdmin :5050
              Event App :5000                 Grafana :3000
                    |                         Prometheus :9090
              PostgreSQL :5432                 Loki :3100

  Node Exporter :9100  ---> Prometheus ---> Grafana
  Docker logs           ---> Promtail ---> Loki ---> Grafana Explore
```

Các container dùng chung Docker bridge network `event-net`. Ứng dụng và PostgreSQL không ánh xạ cổng trực tiếp ra máy host; Nginx chuyển tiếp request đến ứng dụng qua tên service Docker.

## 3. Thành phần và cổng truy cập

| Thành phần | Container | Cổng host | Mục đích |
|---|---|---:|---|
| Website qua Nginx | `nginx` | `80` | Điểm truy cập chính của ứng dụng |
| Event App | `event-app` | Không public | Ứng dụng Node.js/Express, cổng nội bộ `5000` |
| PostgreSQL | `postgres` | Không public | Cơ sở dữ liệu, cổng nội bộ `5432` |
| pgAdmin 4 | `pgadmin` | `5050` | Quản trị PostgreSQL |
| Grafana | `grafana` | `3000` | Dashboard metrics và truy vấn log |
| Prometheus | `prometheus` | `9090` | Thu thập và truy vấn metrics |
| Node Exporter | `node-exporter` | `9100` | Metrics hệ điều hành |
| Loki | `loki` | `3100` | Lưu trữ log tập trung |
| Promtail | `promtail` | Không public | Đọc Docker log và gửi đến Loki |

## 4. Yêu cầu môi trường

- Docker Engine phiên bản hỗ trợ Docker Compose v2.
- Docker Compose Plugin (`docker compose`).
- Git.
- Trình duyệt web.

Kiểm tra cài đặt:

```bash
docker --version
docker compose version
git --version
```

## 5. Cài đặt và khởi chạy

Clone repository:

```bash
git clone https://github.com/Dvihndg/DTC245200706.git
cd DTC245200706
```

Khởi chạy lần đầu và build image ứng dụng:

```bash
docker compose up -d --build
```

Kiểm tra trạng thái container:

```bash
docker compose ps
```

Xem log toàn hệ thống:

```bash
docker compose logs -f
```

Xem log một service:

```bash
docker compose logs -f event-app
docker compose logs -f nginx
docker compose logs -f postgres
```

Dừng hệ thống nhưng giữ lại volume dữ liệu:

```bash
docker compose stop
```

Dừng và xóa container/network nhưng giữ volume:

```bash
docker compose down
```

> Không chạy `docker compose down -v` nếu muốn giữ dữ liệu PostgreSQL, Grafana, pgAdmin, Prometheus và Loki.

## 6. Địa chỉ truy cập

Sau khi khởi chạy thành công:

- Website: http://localhost/
- pgAdmin: http://localhost:5050/
- Grafana: http://localhost:3000/
- Prometheus: http://localhost:9090/
- Loki health check: http://localhost:3100/ready
- Node Exporter metrics: http://localhost:9100/metrics

Nginx chuyển tiếp website đến `event-app:5000` theo cấu hình trong `nginx/default.conf`. Ứng dụng có endpoint metrics tại đường dẫn nội bộ `/metrics`.

## 7. Kết nối PostgreSQL bằng pgAdmin

Đăng nhập pgAdmin tại `http://localhost:5050/` bằng thông tin được cấu hình trong `docker-compose.yml`.

Tạo một Server mới trong pgAdmin với các thông số:

- **Host name/address:** `postgres`
- **Port:** `5432`
- **Maintenance database:** `event_db`
- **Username:** `event_user`
- **Password:** giá trị `POSTGRES_PASSWORD` trong cấu hình Compose

Không dùng `localhost` làm Host trong pgAdmin vì pgAdmin chạy trong container; hãy dùng tên service Docker là `postgres`.

Khi ứng dụng khởi động, server tự tạo hai bảng chính:

- `events`: thông tin sự kiện và số vé còn lại.
- `bookings`: thông tin các lượt đặt vé.

## 8. Prometheus và Grafana

Prometheus được cấu hình trong `prometheus/prometheus.yml` với chu kỳ thu thập mặc định 15 giây. Các target hiện tại gồm:

- `prometheus:9090`
- `node-exporter:9100`
- `event-app:5000`

Kiểm tra target:

1. Mở http://localhost:9090/targets.
2. Kiểm tra các target có trạng thái **UP**.
3. Mở http://localhost:3000/ để vào Grafana.
4. Thêm data source Prometheus với URL nội bộ `http://prometheus:9090`.

Trong Grafana có thể sử dụng các metrics tiêu biểu:

```promql
up
rate(http_requests_total[5m])
node_cpu_seconds_total
```

Các alert rule nằm trong `rules/alerts.yml`, gồm cảnh báo ứng dụng dừng và CPU máy chủ cao.

> Dashboard container/DB chuyên sâu cần được bổ sung exporter tương ứng, ví dụ cAdvisor cho container và postgres-exporter cho PostgreSQL. Hiện cấu hình repository mới chứng minh rõ metrics của Prometheus, Node Exporter và Event App.

## 9. Loki, Promtail và LogQL

Promtail dùng Docker service discovery, đọc log container thông qua Docker socket và gửi đến Loki tại:

```text
http://loki:3100/loki/api/v1/push
```

Trong Grafana:

1. Vào **Connections → Data sources → Add data source**.
2. Chọn **Loki**.
3. Nhập URL `http://loki:3100`.
4. Chọn **Save & test**.
5. Mở **Explore**, chọn data source Loki và chạy các truy vấn:

```logql
{job="docker"}
```

```logql
{job="docker", service="event-app"}
```

```logql
{job="docker"} |= "ERROR"
```

Các label `job`, `container` và `service` được tạo trong `promtail/promtail-config.yml`. Nếu không có dữ liệu, tạo một vài request đến website trước rồi chờ Promtail gửi log về Loki.

## 10. Kiểm tra Nginx Reverse Proxy

Kiểm tra website đi qua Nginx:

```bash
curl -I http://localhost/
```

Kiểm tra cấu hình Nginx trong container:

```bash
docker compose exec nginx nginx -T
```

Cấu hình hiện tại chuyển tiếp:

```text
http://localhost/  ->  http://event-app:5000
```

> **Trạng thái bảo mật cần hoàn thiện:** file `nginx/default.conf` hiện mới có reverse proxy và các header chuyển tiếp cơ bản; chưa khai báo đầy đủ các security headers như `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` và chưa bật HTTPS. Cần bổ sung trước khi khẳng định tiêu chí security headers/HTTPS đã hoàn tất.

## 11. Kiểm tra hardening

Một số cơ chế cách ly hiện có:

- Event App và PostgreSQL không public port trực tiếp ra host.
- Các service dùng Docker bridge network riêng `event-net`.
- Promtail chỉ mount Docker socket ở chế độ read-only.
- Nginx mount file cấu hình ở chế độ read-only.

Các việc cần bổ sung để đáp ứng đầy đủ tiêu chí hardening:

- Chuyển mật khẩu sang file `.env` hoặc Docker secrets và thêm `.env` vào `.gitignore`.
- Không dùng mật khẩu mẫu yếu trong repository.
- Chạy Event App bằng user non-root trong `app/Dockerfile`.
- Cân nhắc `read_only`, `cap_drop: [ALL]` và `security_opt: [no-new-privileges:true]`.
- Bổ sung security headers hoặc HTTPS tự ký cho Nginx.
- Hạn chế các cổng quản trị chỉ cho phép truy cập từ localhost hoặc mạng quản trị.

## 12. Cấu trúc repository

```text
.
├── app/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── loki/
│   └── loki-config.yml
├── nginx/
│   └── default.conf
├── prometheus/
│   └── prometheus.yml
├── promtail/
│   └── promtail-config.yml
├── rules/
│   └── alerts.yml
├── docker-compose.yml
├── README.md
└── .gitignore
```

## 13. Lịch sử các commit chính

| Mốc | Commit | Nội dung |
|---|---|---|
| Commit 1 | `5bbffb0` | Ứng dụng Node.js, PostgreSQL, pgAdmin và Nginx Reverse Proxy |
| Commit 2 | `7a6373f` | Prometheus, Node Exporter và alert rules |
| Commit 3 | `9f1e1e3` | Loki, Promtail, LogQL và README |
| Bổ sung | `f602ab0` | Mở port `5050` cho pgAdmin |

Các commit đầy đủ có thể xem tại:

- https://github.com/Dvihndg/DTC245200706/commits/main

## 14. Ghi chú bảo mật

Các giá trị mật khẩu hiện có trong `docker-compose.yml` chỉ phù hợp cho môi trường thực hành cục bộ. Không sử dụng các giá trị này trong môi trường thật. Khi nộp repository, nên chuyển sang biến môi trường hoặc Docker secrets và tuyệt đối không commit thông tin đăng nhập thật.
