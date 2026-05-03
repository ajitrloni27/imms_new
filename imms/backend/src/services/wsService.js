const { WebSocketServer } = require('ws');
const { setBroadcast } = require('./serialService');

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ event: 'connected', data: { message: 'IMMS WebSocket ready' } }));

    ws.on('close', () => console.log('[WS] Client disconnected'));
    ws.on('error', (err) => console.error('[WS] Error:', err.message));
  });

  // Register broadcast with serial service
  setBroadcast((payload) => {
    if (!wss) return;
    const msg = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(msg);
    });
  });

  console.log('[WS] WebSocket server initialized');
}

module.exports = { initWebSocket };
