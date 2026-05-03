/**
 * IMMS Arduino Firmware
 * Reads Temperature (LM35/DS18B20), Vibration (ADXL345/MPU6050), Pressure sensor
 * Sends JSON over USB Serial every 1 second.
 *
 * Required Libraries:
 *   - ArduinoJson (install via Library Manager)
 *   - OneWire + DallasTemperature (if using DS18B20)
 *   - Wire (built-in, for I2C sensors)
 *
 * Wiring:
 *   LM35      → A0
 *   Vibration → A1 (analog output) or use I2C for ADXL345
 *   Pressure  → A2 (analog output)
 */

#include <ArduinoJson.h>

// ─── CONFIGURATION ───────────────────────────────────────────
#define MACHINE_ID     "M-001"     // Change per machine: M-001, M-002, M-003
#define SEND_INTERVAL  1000        // ms between readings

// Analog pins
#define TEMP_PIN       A0
#define VIBRATION_PIN  A1
#define PRESSURE_PIN   A2

// Sensor calibration
#define VCC            5.0         // Arduino supply voltage
#define ADC_MAX        1023.0

// LM35: 10mV per °C, Vref = 5V
// Temperature (°C) = (ADC * VCC / ADC_MAX) * 100
#define LM35_SCALE     100.0

// Pressure sensor: MPX2050 or similar
// Output: 0.2V–4.7V maps to 0–50 kPa (~0–7.25 psi)
// Adjust MIN_VOLTAGE / MAX_VOLTAGE and MAX_PRESSURE for your sensor
#define PRESSURE_MIN_V 0.2
#define PRESSURE_MAX_V 4.7
#define PRESSURE_MAX   7.0         // bar (adjust to sensor range)

// ─── SETUP ───────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  while (!Serial) { ; }  // Wait for Serial on Leonardo/Micro

  pinMode(TEMP_PIN, INPUT);
  pinMode(VIBRATION_PIN, INPUT);
  pinMode(PRESSURE_PIN, INPUT);

  Serial.println("{\"status\":\"IMMS Arduino Ready\"}");
}

// ─── MAIN LOOP ───────────────────────────────────────────────
void loop() {
  float temperature = readTemperature();
  float vibration   = readVibration();
  float pressure    = readPressure();

  sendJSON(temperature, vibration, pressure);

  delay(SEND_INTERVAL);
}

// ─── SENSOR READERS ──────────────────────────────────────────

/**
 * Read temperature from LM35 (analog).
 * Returns °C.
 */
float readTemperature() {
  int raw = analogRead(TEMP_PIN);
  float voltage = (raw / ADC_MAX) * VCC;
  float tempC = voltage * LM35_SCALE;
  return roundTo2(tempC);
}

/**
 * Read vibration from analog accelerometer.
 * Returns g-force (0.0 – ~8.0).
 * Adjust scale factor for your sensor (ADXL335: ~0.33V/g at 3.3V).
 */
float readVibration() {
  int raw = analogRead(VIBRATION_PIN);
  float voltage = (raw / ADC_MAX) * VCC;
  // ADXL335: sensitivity ~300mV/g at 3.3V supply, zero-g = VCC/2
  float zeroG = VCC / 2.0;
  float sensitivity = 0.33; // V/g (adjust for your sensor)
  float g = abs((voltage - zeroG) / sensitivity);
  return roundTo2(g);
}

/**
 * Read pressure from analog pressure sensor.
 * Returns bar.
 */
float readPressure() {
  int raw = analogRead(PRESSURE_PIN);
  float voltage = (raw / ADC_MAX) * VCC;
  // Map voltage range to pressure range
  float pressureBar = ((voltage - PRESSURE_MIN_V) / (PRESSURE_MAX_V - PRESSURE_MIN_V)) * PRESSURE_MAX;
  pressureBar = constrain(pressureBar, 0.0, PRESSURE_MAX);
  return roundTo2(pressureBar);
}

// ─── JSON OUTPUT ─────────────────────────────────────────────

void sendJSON(float temp, float vibration, float pressure) {
  StaticJsonDocument<128> doc;
  doc["machineId"]  = MACHINE_ID;
  doc["temp"]       = temp;
  doc["vibration"]  = vibration;
  doc["pressure"]   = pressure;

  serializeJson(doc, Serial);
  Serial.println();  // Newline delimiter for ReadlineParser
}

// ─── HELPERS ─────────────────────────────────────────────────

float roundTo2(float val) {
  return round(val * 100.0) / 100.0;
}
