const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  machineId: { type: String, required: true },
  machineName: { type: String, required: true },
  parameter: { type: String, enum: ['temperature', 'vibration', 'pressure'], required: true },
  value: { type: Number, required: true },
  severity: { type: String, enum: ['warning', 'critical'], required: true },
  message: { type: String, required: true },
  acknowledged: { type: Boolean, default: false },
  acknowledgedAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
