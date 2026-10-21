# Hệ thống đặt vé sự kiện – Docker Compose

**Mã số sinh viên:** DTC245200706
**Repository:** https://github.com/DTC245200706/DTC245200706

## 1. Giới thiệu

Hệ thống gồm Event App Node.js/Express, PostgreSQL, pgAdmin 4, Nginx Reverse Proxy, Prometheus, Grafana, Node Exporter, cAdvisor, postgres-exporter, Loki và Promtail. Toàn bộ dịch vụ được quản lý bằng Docker Compose.

Mục tiêu: triển khai ứng dụng và database, reverse proxy HTTPS, thu thập metrics cho web/container/database, tập trung log bằng Loki/Promtail và áp dụng hardening cơ bản.

## 2. Kiến trúc và network isolation

- `frontend`: Nginx, Event App và pgAdmin.
- `backend` (internal): Event App, PostgreSQL và postgres-exporter.
- `monitoring`: Prometheus, Grafana, Loki, Promtail, Node Exporter, cAdvisor và postgres-exporter.
- Event App và PostgreSQL không public port trực tiếp; người dùng truy cập qua Nginx.

## 3. Các cổng truy cập

| Dịch vụ | Địa chỉ | Ghi chú |
|---|---|---|
| Website | https://localhost/ | HTTPS tự ký; trình duyệt sẽ cảnh báo chứng thư demo |
| pgAdmin | http://localhost:5050/ | Chỉ bind localhost |
| Grafana | http://localhost:3000/ | Dashboard và Explore |
| Prometheus | http://localhost:9090/ | Targets và PromQL |
| Loki | http://localhost:3100/ready | Health check |
| Node Exporter | http://localhost:9100/metrics | Host metrics |
| cAdvisor | http://localhost:8080/metrics | Container metrics |

## 4. Chuẩn bị và khởi chạy

Yêu cầu: Docker Engine, Docker Compose v2, Git và OpenSSL.

```bash
git clone https://github.com/DTC245200706/DTC245200706.git
cd DTC245200706
cp .env.example .env
# Sửa các mật khẩu mạnh trong .env trước khi chạy
bash scripts/generate-certs.sh
docker compose up -d --build
docker compose ps
```

Các lệnh vận hành:

```bash
docker compose logs -f
docker compose logs -f event-app
docker compose stop
docker compose down
```

Không chạy `docker compose down -v` nếu muốn giữ dữ liệu database, Grafana, Prometheus, Loki và pgAdmin.

## 5. Database và pgAdmin

Đăng nhập pgAdmin tại `http://localhost:5050/` bằng `PGADMIN_DEFAULT_EMAIL` và `PGADMIN_DEFAULT_PASSWORD` trong `.env`.

Tạo kết nối PostgreSQL:

- Host: `postgres`
- Port: `5432`
- Database: giá trị `POSTGRES_DB`
- User: giá trị `POSTGRES_USER`
- Password: giá trị `POSTGRES_PASSWORD`

Event App tự tạo bảng `events` và `bookings`. Kiểm tra database từ host:

```bash
docker compose exec postgres pg_isready
docker compose logs postgres
docker compose exec event-app wget -qO- http://127.0.0.1:5000/health
```

Endpoint health trả về `{"status":"ok","database":"connected"}` khi ứng dụng kết nối PostgreSQL thành công.

## 6. Nginx, HTTPS và security headers

Nginx redirect HTTP sang HTTPS và reverse proxy đến `event-app:5000`. Cấu hình nằm ở `nginx/default.conf`; chứng thư demo được sinh bởi `scripts/generate-certs.sh` và không commit vào Git.

Kiểm tra website và headers:

```bash
curl -k -I https://localhost/
curl -I http://localhost/
docker compose exec nginx nginx -T
```

Các header được cấu hình gồm `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` và `Content-Security-Policy`.

## 7. Prometheus, Grafana, container và database metrics

Prometheus thu thập:

- `event-app:5000/metrics`: request metrics của web app.
- `node-exporter:9100`: metrics hệ điều hành.
- `cadvisor:8080`: metrics container.
- `postgres-exporter:9187`: metrics PostgreSQL.
- `prometheus:9090`: metrics Prometheus.

Mở http://localhost:9090/targets và kiểm tra các target có trạng thái **UP**. Trong Grafana tại http://localhost:3000/:

1. Đăng nhập bằng `GRAFANA_ADMIN_USER` và `GRAFANA_ADMIN_PASSWORD` trong `.env`.
2. Thêm Prometheus data source: `http://prometheus:9090`.
3. Tạo dashboard với các truy vấn:

```promql
up
rate(http_requests_total[5m])
container_memory_usage_bytes
pg_up
```

Các alert rule nằm trong `rules/alerts.yml`.

## 8. Loki, Promtail và LogQL

Promtail đọc Docker logs bằng Docker service discovery, gắn label `job`, `service` và `container`, rồi gửi log đến Loki.

Trong Grafana, thêm Loki data source với URL `http://loki:3100`, mở **Explore** và chạy:

```logql
{job="docker"}
```

```logql
{job="docker", service="event-app"}
```

```logql
{job="docker"} |= "ERROR"
```

Tạo request trước khi truy vấn để sinh log:

```bash
curl -k https://localhost/
curl -k https://localhost/health
```

## 9. Hardening đã áp dụng

- Event App chạy bằng user `node`, không phải root.
- PostgreSQL nằm trong network `backend` có `internal: true`.
- Secrets nằm trong `.env`, còn `.env` bị loại khỏi Git; repository chỉ chứa `.env.example`.
- Event App có `read_only: true` và thư mục `/tmp` dạng `tmpfs`.
- Nginx, Event App, Node Exporter và Promtail dùng `no-new-privileges`.
- Nginx mount cấu hình và chứng thư ở chế độ read-only.
- PostgreSQL và Event App có healthcheck.
- Security headers và HTTPS tự ký được cấu hình tại Nginx.
- Các cổng quản trị pgAdmin, Prometheus, Loki, Node Exporter và cAdvisor chỉ bind localhost; Grafana vẫn public để demo và nên giới hạn bằng firewall khi triển khai thật.

Kiểm tra non-root và network:

```bash
docker compose exec event-app id
docker network ls
docker inspect event-app --format '{{json .NetworkSettings.Networks}}'
docker inspect event-app --format '{{json .HostConfig.SecurityOpt}}'
```

## 10. Cấu trúc repository

```text
app/                  Event App, Dockerfile và health endpoint
nginx/                Reverse proxy, HTTPS và security headers
prometheus/           Prometheus scrape targets
rules/                Alert rules
loki/                 Loki config
promtail/             Promtail config và LogQL labels
scripts/              Script sinh chứng thư tự ký
docker-compose.yml    Toàn bộ hạ tầng
.env.example          Mẫu biến môi trường, không chứa secrets thật
```

## 11. Lịch sử commit

| Mốc | Commit | Nội dung |
|---|---|---|
| Commit 1 | `5bbffb0` | Event App, PostgreSQL, pgAdmin và Nginx |
| Commit 2 | `7a6373f` | Prometheus, Node Exporter và alert rules |
| Commit 3 | `9f1e1e3` | Loki, Promtail, LogQL và README |
| Bổ sung | `f602ab0` | Mở port pgAdmin |
| Hardening | Sau khi cập nhật | HTTPS, metrics DB/container, healthcheck và non-root |

## 12. Checklist minh chứng khi demo

- [ ] Ảnh website mở qua `https://localhost/`.
- [ ] Ảnh `curl -k -I https://localhost/` có HTTPS và security headers.
- [ ] Ảnh pgAdmin kết nối `postgres` và hiển thị bảng `events`, `bookings`.
- [ ] Ảnh `docker compose ps` và endpoint `/health` trả về database connected.
- [ ] Ảnh Prometheus Targets đều **UP**.
- [ ] Ảnh Grafana dashboard có web, container và PostgreSQL metrics.
- [ ] Ảnh Grafana Explore với tối thiểu 3 query LogQL.
- [ ] Ảnh kiểm tra `id` của Event App cho thấy user không phải root.
- [ ] Ảnh network `backend` có `internal: true` và cấu hình security options.
- [ ] Điền họ tên, lớp và giảng viên vào bìa báo cáo.

## 13. Bảo mật

Không commit `.env`, chứng thư private key hoặc mật khẩu thật. Các giá trị trong `.env.example` chỉ là placeholder và phải được thay bằng mật khẩu mạnh trước khi chạy. Chứng thư tự ký chỉ dùng cho demo nội bộ; môi trường thật nên dùng chứng thư CA hợp lệ.
