const express = require('express');
const router = express.Router();
const { startSerial, stopSerial, listPorts, getStatus } = require('../services/serialService');

// GET /serial/ports — list available ports
router.get('/ports', async (req, res) => {
  const ports = await listPorts();
  res.json({ success: true, data: ports });
});

// GET /serial/status
router.get('/status', (req, res) => {
  res.json({ success: true, data: getStatus() });
});

// POST /serial/start
router.post('/start', async (req, res) => {
  try {
    await startSerial();
    res.json({ success: true, message: 'Serial port started' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /serial/stop
router.post('/stop', (req, res) => {
  stopSerial();
  res.json({ success: true, message: 'Serial port stopped' });
});

module.exports = router;
