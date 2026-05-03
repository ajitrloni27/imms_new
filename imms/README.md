# 🏭 IMMS — Industrial Machine Monitoring System

A production-ready real-time monitoring system for industrial machines.
**Works ONLY with real USB hardware input (Arduino/ESP32).**

---

## 📁 Project Structure

```
imms/
├── backend/
│   ├── src/
│   │   ├── server.js               ← Entry point
│   │   ├── config/db.js            ← MongoDB connection
│   │   ├── models/
│   │   │   ├── Machine.js
│   │   │   └── Alert.js
│   │   ├── routes/
│   │   │   ├── machines.js         ← CRUD API
│   │   │   ├── alerts.js
│   │   │   └── serial.js
│   │   └── services/
│   │       ├── serialService.js    ← USB reader
│   │       ├── thresholdEngine.js  ← Core logic
│   │       └── wsService.js        ← WebSocket
│   ├── .env.example
│   └── package.json
├── frontend/
│   └── index.html                  ← Full dashboard
└── arduino/
    └── IMMS_Sensor.ino             ← Arduino firmware
```

---

## 🚀 HOW TO RUN — STEP BY STEP

### STEP 1: Install Prerequisites

```bash
# Node.js (v18+)
node --version

# MongoDB (local)
mongod --version

# MongoDB must be running:
sudo systemctl start mongod       # Linux
brew services start mongodb-community  # macOS
```

---

### STEP 2: Setup Backend

```bash
cd imms/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/imms
SERIAL_PORT=/dev/ttyUSB0     ← change to your Arduino port
SERIAL_BAUD=9600
DISCONNECT_TIMEOUT=5000
```

**Find your Arduino port:**
```bash
# Linux/macOS:
ls /dev/tty*
# Look for: /dev/ttyUSB0 or /dev/ttyACM0

# Windows:
# Open Device Manager → Ports (COM & LPT) → look for COM3, COM4, etc.
# Use: SERIAL_PORT=COM3
```

---

### STEP 3: Setup Arduino

1. Open Arduino IDE
2. Install library: **ArduinoJson** (Library Manager → search "ArduinoJson")
3. Open `arduino/IMMS_Sensor.ino`
4. Change `MACHINE_ID` to match the machine you'll register (e.g., `"M-001"`)
5. Upload to Arduino

Arduino will send this every second:
```json
{"machineId":"M-001","temp":72.5,"vibration":1.2,"pressure":3.4}
```

---

### STEP 4: Start Backend

```bash
cd imms/backend
npm start
```

You'll see:
```
[DB] MongoDB connected
[Server] Running on http://localhost:5000
[WS] WebSocket server initialized
[Serial] Opening port /dev/ttyUSB0 at 9600 baud...
[Serial] Port opened successfully.
```

---

### STEP 5: Register Machines via API

```bash
# Add Machine 1
curl -X POST http://localhost:5000/api/machines \
  -H "Content-Type: application/json" \
  -d '{"name":"Compressor A"}'

# Add Machine 2
curl -X POST http://localhost:5000/api/machines \
  -H "Content-Type: application/json" \
  -d '{"name":"Pump Station B"}'

# View all machines
curl http://localhost:5000/api/machines
```

The returned `id` (e.g., `M-4F2A1B`) must match the `MACHINE_ID` in your Arduino sketch.

---

### STEP 6: Open Dashboard

Open `frontend/index.html` in your browser:
```bash
# Option 1: Direct file open
open frontend/index.html        # macOS
xdg-open frontend/index.html   # Linux

# Option 2: Serve with npx
npx serve frontend -p 3000
# Then open: http://localhost:3000
```

---

## 🔌 API ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/machines` | List all machines |
| POST | `/api/machines` | Add machine |
| PUT | `/api/machines/:id` | Update machine |
| DELETE | `/api/machines/:id` | Delete machine |
| POST | `/api/machines/:id/connect` | Mark connected |
| POST | `/api/machines/:id/disconnect` | Mark disconnected |
| GET | `/api/alerts` | Get alerts (supports filters) |
| POST | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| DELETE | `/api/alerts/:id` | Delete alert |
| GET | `/api/serial/ports` | List USB ports |
| GET | `/api/serial/status` | Serial status |
| POST | `/api/serial/start` | Start serial |
| POST | `/api/serial/stop` | Stop serial |
| GET | `/api/health` | Health check |

---

## 🧠 HOW IT WORKS — EXPLANATIONS

### 1. Data Flow: Sensor → Dashboard

```
Sensor (LM35/Vibration/Pressure)
  ↓  analog signal
Arduino/ESP32
  ↓  reads analog pins, computes real values
  ↓  formats JSON: {"machineId":"M-001","temp":72,"vibration":1.5,"pressure":3.2}
USB Serial Cable (9600 baud)
  ↓  sends newline-delimited JSON every 1 second
Node.js serialService.js
  ↓  ReadlineParser splits on \n, parses JSON
thresholdEngine.js
  ↓  compares each value against fixed thresholds
  ↓  assigns: ok / warning / critical
Machine model (MongoDB)
  ↓  updated in database
WebSocket (ws://)
  ↓  broadcasts update to all connected browsers
Frontend Dashboard
  ↓  receives event, re-renders card in real time
```

---

### 2. USB Communication

- Node.js uses the `serialport` npm library
- Opens the USB port (e.g., `/dev/ttyUSB0`) at 9600 baud
- `ReadlineParser` collects characters until a `\n` newline
- Each complete line is parsed as JSON
- Invalid JSON is safely ignored with a warning log
- If the port closes unexpectedly, an error is logged and `isRunning` is set false

---

### 3. Threshold Comparison Logic

No ML, no datasets. Pure if/else thresholds:

```
Temperature (°C):
  < 80        →  OK
  80 – 95     →  WARNING
  > 95        →  CRITICAL

Vibration (g-force):
  < 2         →  OK
  2 – 5       →  WARNING
  > 5         →  CRITICAL

Pressure (bar):
  2.0 – 5.0   →  OK
  1.0 – 2.0   →  WARNING (low)
  5.0 – 7.0   →  WARNING (high)
  < 1.0       →  CRITICAL (too low)
  > 7.0       →  CRITICAL (too high)

Overall Machine Status:
  Any CRITICAL → machine = CRITICAL
  Any WARNING  → machine = WARNING
  All OK       → machine = OK
```

---

### 4. Connection / Disconnection Detection

- When Arduino data arrives → `machine.connected = true`, `lastSeen = now`
- A per-machine timer is set for **5 seconds**
- Every new data packet **resets** this timer
- If **no data arrives for 5 seconds** → timer fires → `machine.connected = false`
- This is broadcast via WebSocket → dashboard card shows "Disconnected"
- Controlled by `DISCONNECT_TIMEOUT` in `.env`

---

## 🚀 DEPLOYMENT (Render)

### Backend on Render

1. Push backend to GitHub
2. New Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in Render dashboard:
   - `MONGODB_URI` → MongoDB Atlas connection string
   - `PORT` → 5000
   - `SERIAL_PORT` → `/dev/ttyUSB0` (note: USB only works locally)

### Frontend on Render (Static Site)

1. New Static Site → Connect repo
2. Publish directory: `frontend`
3. Update `API` and `WS_URL` in `index.html` to your Render backend URL

### ⚠️ USB Note on Cloud Deployment

USB serial communication **requires physical access to the machine**.  
When deployed on Render, the backend runs on a remote server with no USB access.  
For production use: run the backend **locally** on the machine connected to Arduino,  
and only deploy the frontend to Render (pointing to your local IP).

---

## 🔧 HARDWARE WIRING

```
Arduino Uno:
  LM35 (Temperature):
    VCC → 5V
    GND → GND
    OUT → A0

  Analog Vibration Sensor (ADXL335):
    VCC → 3.3V
    GND → GND
    X-OUT → A1

  Pressure Sensor (MPX2050 or similar):
    VCC → 5V
    GND → GND
    OUT → A2
```

For multiple machines: use multiple Arduinos, each with unique `MACHINE_ID`.  
Each Arduino connects via a separate USB port.  
Update `.env` to point to the correct port, or extend `serialService.js` to handle multiple ports.

---

## 📦 DEPENDENCIES

Backend:
- `express` — REST API
- `mongoose` — MongoDB ODM
- `serialport` — USB serial communication
- `@serialport/parser-readline` — Line-based parser
- `ws` — WebSocket server
- `uuid` — Machine ID generation
- `dotenv` — Environment config
- `cors` — Cross-origin support
