const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { evaluateMachineStatus, generateAlerts } = require('./thresholdEngine');
const Machine = require('../models/Machine');
const Alert = require('../models/Alert');

const DISCONNECT_TIMEOUT = parseInt(process.env.DISCONNECT_TIMEOUT) || 5000;

// Track per-machine disconnect timers
const disconnectTimers = new Map();
// Broadcast function set by WebSocket service
let broadcastFn = null;

let port = null;
let parser = null;
let isRunning = false;

/**
 * Register WebSocket broadcast callback.
 */
function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(event, data) {
  if (broadcastFn) broadcastFn({ event, data });
}

/**
 * List all available serial ports on the system.
 */
async function listPorts() {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (err) {
    console.error('[Serial] Failed to list ports:', err.message);
    return [];
  }
}

/**
 * Start listening on the configured serial port.
 */
async function startSerial() {
  const portPath = process.env.SERIAL_PORT || '/dev/ttyUSB0';
  const baudRate = parseInt(process.env.SERIAL_BAUD) || 9600;

  if (isRunning) {
    console.log('[Serial] Already running.');
    return;
  }

  console.log(`[Serial] Opening port ${portPath} at ${baudRate} baud...`);

  try {
    port = new SerialPort({ path: portPath, baudRate, autoOpen: false });

    port.open((err) => {
      if (err) {
        console.error(`[Serial] Cannot open port: ${err.message}`);
        return;
      }
      console.log('[Serial] Port opened successfully.');
      isRunning = true;
    });

    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', async (raw) => {
      await handleIncomingData(raw.trim());
    });

    port.on('error', (err) => {
      console.error('[Serial] Port error:', err.message);
      isRunning = false;
    });

    port.on('close', () => {
      console.log('[Serial] Port closed.');
      isRunning = false;
    });

  } catch (err) {
    console.error('[Serial] Failed to initialize:', err.message);
  }
}

/**
 * Stop the serial connection.
 */
function stopSerial() {
  if (port && port.isOpen) {
    port.close();
  }
  isRunning = false;
  disconnectTimers.forEach((timer) => clearTimeout(timer));
  disconnectTimers.clear();
}

/**
 * Process one line of incoming serial data.
 * Expected format: {"machineId":"M-001","temp":72,"vibration":1.5,"pressure":3.2}
 */
async function handleIncomingData(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[Serial] Invalid JSON received:', raw);
    return;
  }

  const { machineId, temp, vibration, pressure } = parsed;

  if (!machineId) {
    console.warn('[Serial] Missing machineId in data:', raw);
    return;
  }

  // Find machine in DB
  const machine = await Machine.findOne({ id: machineId });
  if (!machine) {
    console.warn(`[Serial] Unknown machineId: ${machineId}. Register this machine first.`);
    return;
  }

  // Evaluate status
  const status = evaluateMachineStatus(temp, vibration, pressure);

  // Update machine
  machine.temperature = temp ?? machine.temperature;
  machine.vibration = vibration ?? machine.vibration;
  machine.pressure = pressure ?? machine.pressure;
  machine.status = status;
  machine.connected = true;
  machine.lastSeen = new Date();
  await machine.save();

  // Generate & save alerts
  const newAlerts = generateAlerts(machine.id, machine.name, temp, vibration, pressure);
  for (const alertData of newAlerts) {
    await Alert.create(alertData);
  }

  // Broadcast update to all WebSocket clients
  broadcast('machine:update', machine.toObject());
  if (newAlerts.length > 0) {
    broadcast('alerts:new', newAlerts);
  }

  // Reset disconnect timer
  resetDisconnectTimer(machine);
}

/**
 * Reset the disconnect timer for a machine.
 * If no data arrives within DISCONNECT_TIMEOUT, mark as disconnected.
 */
function resetDisconnectTimer(machine) {
  if (disconnectTimers.has(machine.id)) {
    clearTimeout(disconnectTimers.get(machine.id));
  }

  const timer = setTimeout(async () => {
    try {
      const m = await Machine.findOne({ id: machine.id });
      if (m) {
        m.connected = false;
        m.status = 'unknown';
        await m.save();
        broadcast('machine:disconnected', { machineId: machine.id });
        console.log(`[Serial] Machine ${machine.id} marked as disconnected.`);
      }
    } catch (err) {
      console.error('[Serial] Disconnect timer error:', err.message);
    }
    disconnectTimers.delete(machine.id);
  }, DISCONNECT_TIMEOUT);

  disconnectTimers.set(machine.id, timer);
}

function getStatus() {
  return {
    isRunning,
    portPath: process.env.SERIAL_PORT || '/dev/ttyUSB0',
    baudRate: parseInt(process.env.SERIAL_BAUD) || 9600
  };
}

module.exports = { startSerial, stopSerial, listPorts, setBroadcast, getStatus };
