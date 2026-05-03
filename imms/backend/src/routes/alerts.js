const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET /alerts — list alerts with optional filters
router.get('/', async (req, res) => {
  try {
    const { machineId, severity, acknowledged, limit = 100 } = req.query;
    const filter = {};

    if (machineId) filter.machineId = machineId;
    if (severity) filter.severity = severity;
    if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';

    const alerts = await Alert.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /alerts/:id/acknowledge
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
