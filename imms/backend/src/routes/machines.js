const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine');
const { v4: uuidv4 } = require('uuid');

// GET /machines — list all
router.get('/', async (req, res) => {
  try {
    const machines = await Machine.find().sort({ createdAt: 1 });
    res.json({ success: true, data: machines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /machines/:id
router.get('/:id', async (req, res) => {
  try {
    const machine = await Machine.findOne({ id: req.params.id });
    if (!machine) return res.status(404).json({ success: false, error: 'Machine not found' });
    res.json({ success: true, data: machine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /machines — add machine
router.post('/', async (req, res) => {
  try {
    const { name, serialPort } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Machine name is required' });

    const id = `M-${uuidv4().slice(0, 6).toUpperCase()}`;
    const machine = await Machine.create({ id, name, serialPort: serialPort || null });
    res.status(201).json({ success: true, data: machine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /machines/:id — update machine name/serialPort
router.put('/:id', async (req, res) => {
  try {
    const { name, serialPort } = req.body;
    const machine = await Machine.findOne({ id: req.params.id });
    if (!machine) return res.status(404).json({ success: false, error: 'Machine not found' });

    if (name) machine.name = name;
    if (serialPort !== undefined) machine.serialPort = serialPort;
    await machine.save();

    res.json({ success: true, data: machine });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /machines/:id
router.delete('/:id', async (req, res) => {
  try {
    const machine = await Machine.findOneAndDelete({ id: req.params.id });
    if (!machine) return res.status(404).json({ success: false, error: 'Machine not found' });
    res.json({ success: true, message: `Machine ${req.params.id} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /machines/:id/connect
router.post('/:id/connect', async (req, res) => {
  try {
    const machine = await Machine.findOne({ id: req.params.id });
    if (!machine) return res.status(404).json({ success: false, error: 'Machine not found' });
    machine.connected = true;
    await machine.save();
    res.json({ success: true, message: `Machine ${req.params.id} marked connected` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /machines/:id/disconnect
router.post('/:id/disconnect', async (req, res) => {
  try {
    const machine = await Machine.findOne({ id: req.params.id });
    if (!machine) return res.status(404).json({ success: false, error: 'Machine not found' });
    machine.connected = false;
    machine.status = 'unknown';
    await machine.save();
    res.json({ success: true, message: `Machine ${req.params.id} marked disconnected` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
