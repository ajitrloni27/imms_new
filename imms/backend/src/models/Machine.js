const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  serialPort: { type: String, default: null },
  temperature: { type: Number, default: null },
  vibration: { type: Number, default: null },
  pressure: { type: Number, default: null },
  status: { type: String, enum: ['ok', 'warning', 'critical', 'unknown'], default: 'unknown' },
  connected: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Machine', machineSchema);
