/**
 * Configuration validation functions with graceful defaults
 *
 * All validation failures log warnings to console and return safe defaults.
 * No errors are thrown to ensure graceful degradation.
 */

/**
 * Validate configuration object against defaults
 * @param {Object} userConfig - User-provided configuration
 * @param {Object} defaults - Default configuration object
 * @param {string} path - Current path in config tree (for error messages)
 * @returns {Object} Validated configuration
 */
export function validateConfig(userConfig, defaults, path = 'config') {
  const validated = {};

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const userValue = userConfig?.[key];
    const currentPath = `${path}.${key}`;

    // Use default if user value is undefined
    if (userValue === undefined) {
      validated[key] = defaultValue;
      continue;
    }

    // Type validation
    if (typeof userValue !== typeof defaultValue) {
      console.warn(
        `Config validation: ${currentPath} should be ${typeof defaultValue}, got ${typeof userValue}. Using default.`
      );
      validated[key] = defaultValue;
      continue;
    }

    // Recursive validation for nested objects (but not arrays)
    if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
      validated[key] = validateConfig(userValue, defaultValue, currentPath);
      continue;
    }

    // Number validation (range checks)
    if (typeof defaultValue === 'number') {
      validated[key] = validateNumber(userValue, defaultValue, currentPath);
      continue;
    }

    // Accept valid values as-is
    validated[key] = userValue;
  }

  return validated;
}

/**
 * Validate number with range checks
 * @param {number} value - Value to validate
 * @param {number} defaultValue - Default value to use on failure
 * @param {string} label - Label for error messages
 * @param {number} min - Minimum allowed value (default: 0)
 * @param {number} max - Maximum allowed value (default: Infinity)
 * @returns {number} Validated value or default
 */
export function validateNumber(value, defaultValue, label = 'value', min = 0, max = Infinity) {
  // Check if value is a finite number
  if (typeof value !== 'number' || !isFinite(value)) {
    console.warn(
      `Config validation: ${label} must be a finite number, got ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  // Check range
  if (value < min || value > max) {
    console.warn(
      `Config validation: ${label} must be between ${min} and ${max}, got ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return value;
}

/**
 * Validate number with custom range
 * @param {number} value - Value to validate
 * @param {number} defaultValue - Default value to use on failure
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {string} label - Label for error messages
 * @returns {number} Validated value or default
 */
export function validateNumberInRange(value, defaultValue, min, max, label = 'value') {
  return validateNumber(value, defaultValue, label, min, max);
}

/**
 * Validate positive number (greater than 0)
 * @param {number} value - Value to validate
 * @param {number} defaultValue - Default value to use on failure
 * @param {string} label - Label for error messages
 * @returns {number} Validated value or default
 */
export function validatePositiveNumber(value, defaultValue, label = 'value') {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    console.warn(
      `Config validation: ${label} must be a positive number, got ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return value;
}

/**
 * Validate probability value (between 0 and 1)
 * @param {number} value - Value to validate
 * @param {number} defaultValue - Default value to use on failure
 * @param {string} label - Label for error messages
 * @returns {number} Validated value or default
 */
export function validateProbability(value, defaultValue, label = 'value') {
  return validateNumberInRange(value, defaultValue, 0, 1, label);
}

/**
 * Detect if dev mode enabled via URL parameter
 * @returns {boolean} True if ?perf=true in URL
 */
export function isDevMode() {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('perf') === 'true';
}

/**
 * Parse and validate speed multiplier from URL parameter
 * @param {number} defaultValue - Default speed multiplier
 * @returns {number} Validated speed multiplier
 */
export function getSpeedFromURL(defaultValue = 1.0) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const speedParam = urlParams.get('speed');

  if (speedParam === null) return defaultValue;

  const speed = parseFloat(speedParam);
  return validatePositiveNumber(speed, defaultValue, 'URL parameter speed');
}

/**
 * Parse and validate density from URL parameter
 * @param {number} defaultValue - Default bar density
 * @param {number} min - Minimum allowed density
 * @param {number} max - Maximum allowed density
 * @returns {number} Validated density
 */
export function getDensityFromURL(defaultValue = 15, min = 1, max = 50) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const densityParam = urlParams.get('density');

  if (densityParam === null) return defaultValue;

  const density = parseInt(densityParam, 10);
  return validateNumberInRange(density, defaultValue, min, max, 'URL parameter density');
}

/**
 * Parse and validate duration from URL parameter
 * @param {number} defaultValue - Default duration in milliseconds
 * @returns {number} Validated duration
 */
export function getDurationFromURL(defaultValue = 1000) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const durationParam = urlParams.get('duration');

  if (durationParam === null) return defaultValue;

  const duration = parseInt(durationParam, 10);
  return validatePositiveNumber(duration, defaultValue, 'URL parameter duration');
}
