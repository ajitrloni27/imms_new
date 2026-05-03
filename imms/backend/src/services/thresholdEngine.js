/**
 * THRESHOLD-BASED COMPARISON ENGINE
 * No ML, no datasets — pure threshold logic.
 */

const THRESHOLDS = {
  temperature: {
    ok: { max: 80 },
    warning: { min: 80, max: 95 },
    critical: { min: 95 }
  },
  vibration: {
    ok: { max: 2 },
    warning: { min: 2, max: 5 },
    critical: { min: 5 }
  },
  pressure: {
    ok: { min: 2, max: 5 },
    warning: { lowMin: 1, lowMax: 2, highMin: 5, highMax: 7 },
    critical: { max: 1, min: 7 }
  }
};

/**
 * Evaluate a single parameter against thresholds.
 * Returns: 'ok' | 'warning' | 'critical'
 */
function evaluateParameter(parameter, value) {
  if (value === null || value === undefined) return 'unknown';

  if (parameter === 'temperature') {
    if (value > 95) return 'critical';
    if (value >= 80) return 'warning';
    return 'ok';
  }

  if (parameter === 'vibration') {
    if (value > 5) return 'critical';
    if (value >= 2) return 'warning';
    return 'ok';
  }

  if (parameter === 'pressure') {
    if (value < 1 || value > 7) return 'critical';
    if (value < 2 || value > 5) return 'warning';
    return 'ok';
  }

  return 'unknown';
}

/**
 * Determine overall machine status from all parameters.
 * Priority: critical > warning > ok
 */
function evaluateMachineStatus(temp, vibration, pressure) {
  const results = [
    evaluateParameter('temperature', temp),
    evaluateParameter('vibration', vibration),
    evaluateParameter('pressure', pressure)
  ];

  if (results.includes('critical')) return 'critical';
  if (results.includes('warning')) return 'warning';
  if (results.includes('unknown')) return 'unknown';
  return 'ok';
}

/**
 * Generate alert objects for any parameter exceeding thresholds.
 */
function generateAlerts(machineId, machineName, temp, vibration, pressure) {
  const alerts = [];
  const params = { temperature: temp, vibration, pressure };

  for (const [param, value] of Object.entries(params)) {
    const severity = evaluateParameter(param, value);
    if (severity === 'warning' || severity === 'critical') {
      alerts.push({
        machineId,
        machineName,
        parameter: param,
        value,
        severity,
        message: buildAlertMessage(param, value, severity)
      });
    }
  }

  return alerts;
}

function buildAlertMessage(param, value, severity) {
  const units = { temperature: '°C', vibration: 'g', pressure: 'bar' };
  const unit = units[param] || '';
  const label = param.charAt(0).toUpperCase() + param.slice(1);
  return `${label} ${severity.toUpperCase()}: ${value}${unit} exceeds safe threshold`;
}

function getThresholds() {
  return THRESHOLDS;
}

module.exports = {
  evaluateParameter,
  evaluateMachineStatus,
  generateAlerts,
  getThresholds
};
