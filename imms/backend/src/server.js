require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { initWebSocket } = require('./services/wsService');
const { startSerial } = require('./services/serialService');

const machineRoutes = require('./routes/machines');
const alertRoutes = require('./routes/alerts');
const serialRoutes = require('./routes/serial');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/machines', machineRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/serial', serialRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function boot() {
  await connectDB();
  initWebSocket(server);

  server.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket ready on ws://localhost:${PORT}`);
  });

  // Auto-start serial if port is defined
  if (process.env.SERIAL_PORT) {
    console.log('[Server] Auto-starting serial port listener...');
    await startSerial();
  } else {
    console.log('[Server] No SERIAL_PORT set. Use POST /api/serial/start after setting port in .env');
  }
}

boot();
