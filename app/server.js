const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
const port = 5000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Tích hợp Metric Prometheus
client.collectDefaultMetrics();
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Tong so request',
  labelNames: ['method', 'route', 'status']
});

// Kết nối PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'event_user',
  password: process.env.DB_PASSWORD || 'event_pass',
  database: process.env.DB_NAME || 'event_db',
  port: 5432,
});

// Tự động tạo bảng và dữ liệu sự kiện ban đầu
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(100) NOT NULL,
        total_tickets INT NOT NULL,
        remaining_tickets INT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        event_id INT REFERENCES events(id),
        user_name VARCHAR(100) NOT NULL,
        user_email VARCHAR(100) NOT NULL,
        tickets INT NOT NULL,
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const res = await pool.query('SELECT COUNT(*) FROM events');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO events (title, date, total_tickets, remaining_tickets) VALUES
        ('Hội thảo IT & DevOps Cloud', '2026-10-15', 100, 100),
        ('Đêm nhạc EDM Sinh viên ICTU', '2026-11-20', 250, 250);
      `);
    }
    console.log("Database initialized successfully!");
  } catch (e) {
    console.error("Dang doi database khoi dong...", e.message);
    setTimeout(initDB, 3000);
  }
}
initDB();

// Log mọi request
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    console.log(`[EVENT_LOG] ${req.method} ${req.path} Status:${res.statusCode}`);
  });
  next();
});

// Endpoint metric
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Trang chủ xem sự kiện và đặt vé
app.get('/', async (req, res) => {
  try {
    const events = await pool.query('SELECT * FROM events ORDER BY id ASC');
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hệ Thống Đặt Vé Sự Kiện</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="container py-4 bg-light">
        <h2 class="text-primary mb-4">Cổng Đăng Ký Vé Sự Kiện Trực Tuyến</h2>
        <div class="row">
    `;
    events.rows.forEach(e => {
      html += `
        <div class="col-md-6 mb-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <h5 class="card-title">${e.title}</h5>
              <p>Ngày diễn ra: <strong>${e.date}</strong></p>
              <p>Số vé còn lại: <span class="badge bg-success">${e.remaining_tickets} / ${e.total_tickets}</span></p>
              <form action="/book" method="POST">
                <input type="hidden" name="event_id" value="${e.id}">
                <div class="mb-2"><input class="form-control" name="user_name" placeholder="Họ và tên" required></div>
                <div class="mb-2"><input class="form-control" type="email" name="user_email" placeholder="Email nhận vé" required></div>
                <div class="mb-2"><input class="form-control" type="number" name="tickets" value="1" min="1" max="5" required></div>
                <button type="submit" class="btn btn-primary w-100" ${e.remaining_tickets <= 0 ? 'disabled' : ''}>
                  ${e.remaining_tickets > 0 ? 'Xác Nhận Đặt Vé' : 'Hết Vé'}
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div></body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send("Lỗi kết nối cơ sở dữ liệu: " + err.message);
  }
});

// Xử lý logic đặt vé
app.post('/book', async (req, res) => {
  const { event_id, user_name, user_email, tickets } = req.body;
  try {
    const ev = await pool.query('SELECT remaining_tickets FROM events WHERE id = $1', [event_id]);
    if (ev.rows.length > 0 && ev.rows[0].remaining_tickets >= tickets) {
      await pool.query('BEGIN');
      await pool.query('INSERT INTO bookings (event_id, user_name, user_email, tickets) VALUES ($1, $2, $3, $4)', [event_id, user_name, user_email, tickets]);
      await pool.query('UPDATE events SET remaining_tickets = remaining_tickets - $1 WHERE id = $2', [tickets, event_id]);
      await pool.query('COMMIT');
      console.log(`[BOOKING SUCCESS] Khách ${user_name} (${user_email}) mua ${tickets} vé sự kiện ID ${event_id}`);
      res.send('<script>alert("Đặt vé thành công!"); window.location.href="/";</script>');
    } else {
      res.status(400).send("Số lượng vé còn lại không đủ!");
    }
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error("[BOOKING ERROR]", err.message);
    res.status(500).send("Lỗi máy chủ khi đặt vé");
  }
});

app.listen(port, () => console.log(`Event app chay tai cong ${port}`));
