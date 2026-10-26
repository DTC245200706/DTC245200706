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

// Khởi tạo Database bảng sự kiện và vé đặt
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
        ticket_code VARCHAR(50) UNIQUE NOT NULL,
        event_id INT REFERENCES events(id),
        user_name VARCHAR(100) NOT NULL,
        user_phone VARCHAR(20) NOT NULL,
        user_email VARCHAR(100) NOT NULL,
        ticket_type VARCHAR(50) NOT NULL,
        quantity INT NOT NULL,
        total_amount INT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Đã thanh toán',
        check_in VARCHAR(50) DEFAULT 'Chưa check-in',
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const res = await pool.query('SELECT COUNT(*) FROM events');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO events (title, date, total_tickets, remaining_tickets) VALUES
        ('Tech & Music Festival 2026', '2026-12-15', 245, 245);
      `);
    }
  } catch (err) {
    console.error('Lỗi khởi tạo Database:', err);
  }
}

initDB();

// API lấy dữ liệu vé cho Admin & Frontend
app.get('/api/tickets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY booked_at DESC');
    const formatted = result.rows.map(row => ({
      id: row.ticket_code,
      name: row.user_name,
      phone: row.user_phone,
      email: row.user_email,
      type: row.ticket_type,
      quantity: row.quantity,
      total: row.total_amount,
      paymentMethod: row.payment_method,
      status: row.status,
      checkIn: row.check_in,
      createdAt: row.booked_at ? row.booked_at.toISOString().slice(0, 16).replace('T', ' ') : ''
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi lấy danh sách vé' });
  }
});

// API tạo đặt vé mới từ Frontend
app.post('/api/book', async (req, res) => {
  const { name, phone, email, type, quantity, paymentMethod } = req.body;
  try {
    const qty = parseInt(quantity) || 1;
    let unitPrice = 399000;
    if (type === 'VIP') unitPrice = 899000;
    if (type === 'Super VIP') unitPrice = 1999000;
    const total = unitPrice * qty;
    const ticketCode = "NEX-" + Math.floor(1000 + Math.random() * 9000);

    const eventRes = await pool.query('SELECT id FROM events LIMIT 1');
    const eventId = eventRes.rows.length > 0 ? eventRes.rows[0].id : 1;

    await pool.query(
      'INSERT INTO bookings (ticket_code, event_id, user_name, user_phone, user_email, ticket_type, quantity, total_amount, payment_method, status, check_in) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [ticketCode, eventId, name, phone, email, type, qty, total, paymentMethod, 'Đã thanh toán', 'Chưa check-in']
    );

    res.json({ success: true, ticket: { id: ticketCode, name, phone, email, type, quantity: qty, total, paymentMethod, status: 'Đã thanh toán', checkIn: 'Chưa check-in' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xử lý đặt vé' });
  }
});

// API cập nhật trạng thái check-in hoặc thanh toán
app.put('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const { status, checkIn } = req.body;
  try {
    if (status !== undefined) {
      await pool.query('UPDATE bookings SET status = $1 WHERE ticket_code = $2', [status, id]);
    }
    if (checkIn !== undefined) {
      await pool.query('UPDATE bookings SET check_in = $1 WHERE ticket_code = $2', [checkIn, id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi cập nhật vé' });
  }
});

// API xóa vé
app.delete('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM bookings WHERE ticket_code = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi xóa vé' });
  }
});

// Route trang chủ trả về file index.html cực kỳ sạch sẽ
app.get('/', async (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Endpoint metrics Prometheus
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Health check cho Docker
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server đang chạy tại cổng ${port}`);
});
