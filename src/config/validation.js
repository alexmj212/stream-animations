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

/**
 * Validate duration values (milliseconds)
 * @param {object} durations - Duration config object
 * @param {object} defaults - Default values
 * @returns {object} Validated durations
 */
export function validateDurations(durations, defaults) {
  if (!durations || typeof durations !== 'object') {
    console.warn('Config validation: durations must be an object. Using defaults.');
    return defaults;
  }

  const validated = {};

  // Validate common duration fields
  if (durations.defaultMs !== undefined) {
    validated.defaultMs = validateNumber(durations.defaultMs, defaults.defaultMs, 'durations.defaultMs', 100, 10000);
  }
  if (durations.entryMs !== undefined) {
    validated.entryMs = validateNumber(durations.entryMs, defaults.entryMs, 'durations.entryMs', 100, 10000);
  }
  if (durations.exitMs !== undefined) {
    validated.exitMs = validateNumber(durations.exitMs, defaults.exitMs, 'durations.exitMs', 100, 10000);
  }
  if (durations.holdMs !== undefined) {
    validated.holdMs = validateNumber(durations.holdMs, defaults.holdMs, 'durations.holdMs', 0, 30000);
  }

  // Validate background-specific fields
  if (durations.holdMinMs !== undefined) {
    validated.holdMinMs = validateNumber(durations.holdMinMs, defaults.holdMinMs, 'durations.holdMinMs', 0, 300000);
  }
  if (durations.holdMaxMs !== undefined) {
    validated.holdMaxMs = validateNumber(durations.holdMaxMs, defaults.holdMaxMs, 'durations.holdMaxMs', 0, 300000);
  }
  if (durations.transitionMs !== undefined) {
    validated.transitionMs = validateNumber(durations.transitionMs, defaults.transitionMs, 'durations.transitionMs', 100, 10000);
  }

  return validated;
}

/**
 * Validate brightness multiplier (0-1 range)
 * @param {number} brightness - Brightness multiplier
 * @param {number} defaultBrightness - Default value
 * @param {string} label - Config path for logging
 * @returns {number} Validated brightness (0-1)
 */
export function validateBrightness(brightness, defaultBrightness, label) {
  return validateNumber(brightness, defaultBrightness, label, 0, 1);
}

/**
 * Validate easing function name exists
 * @param {string} easingFunction - Function name
 * @param {string} defaultEasing - Default value
 * @returns {string} Validated easing function name
 */
export function validateEasingFunction(easingFunction, defaultEasing = 'easeInOutCubic') {
  if (typeof easingFunction !== 'string' || easingFunction.trim() === '') {
    console.warn(`Config validation: easingFunction must be a non-empty string. Using default: ${defaultEasing}`);
    return defaultEasing;
  }
  // Note: Currently only easeInOutCubic implemented in AnimatedBar
  // This validates format only, not that method exists
  return easingFunction;
}

/**
 * Validate sidebar positioning constraints
 * @param {object} position - Position config
 * @param {object} defaults - Default values
 * @returns {object} Validated position
 */
export function validateSidebarPositioning(position, defaults) {
  if (!position || typeof position !== 'object') {
    console.warn('Config validation: sidebar.position must be an object. Using defaults.');
    return defaults;
  }

  const sidebarStart = validateNumber(position.sidebarStart, defaults.sidebarStart, 'sidebar.position.sidebarStart', 0, 1);
  const sidebarWidth = validateNumber(position.sidebarWidth, defaults.sidebarWidth, 'sidebar.position.sidebarWidth', 0, 1);

  // Logical constraint: sidebar must fit within viewport
  if (sidebarStart + sidebarWidth > 1.0) {
    console.warn(
      `Config validation: sidebar.position.sidebarStart (${sidebarStart}) + sidebarWidth (${sidebarWidth}) exceeds viewport (1.0). Sidebar may extend off-screen.`
    );
  }

  return {
    sidebarStart,
    sidebarWidth,
    horizontalTargetOffset: validateNumber(
      position.horizontalTargetOffset,
      defaults.horizontalTargetOffset,
      'sidebar.position.horizontalTargetOffset',
      -1000,
      1000
    )
  };
}

/**
 * Validate shade scene configuration
 * @param {object} shade - Shade config section
 * @returns {boolean} True if all validations pass, false if any warnings logged
 */
export function validateShadeConfig(shade) {
  if (!shade || typeof shade !== 'object') {
    console.warn('Config validation: config.shade section missing or invalid. Shade scene may not work correctly.');
    return false;
  }

  let allValid = true;

  // Validate brightness
  if (typeof shade.brightness !== 'number' || shade.brightness < 0 || shade.brightness > 1) {
    console.warn(`Config validation: config.shade.brightness must be between 0 and 1, got ${shade.brightness}. Using default: 0.8`);
    allValid = false;
  }

  // Validate text config
  if (shade.text) {
    const text = shade.text;

    // Validate font string
    if (typeof text.font !== 'string' || text.font.trim() === '') {
      console.warn('Config validation: config.shade.text.font must be a non-empty string. Using default: "bold 96px Jost"');
      allValid = false;
    }

    // Validate color string
    if (typeof text.color !== 'string' || text.color.trim() === '') {
      console.warn('Config validation: config.shade.text.color must be a non-empty string. Using default: "#ffffff"');
      allValid = false;
    }

    // Validate shadow properties
    if (text.shadow) {
      const shadow = text.shadow;

      if (typeof shadow.blur !== 'number' || shadow.blur < 0) {
        console.warn(`Config validation: config.shade.text.shadow.blur must be >= 0, got ${shadow.blur}. Using default: 8`);
        allValid = false;
      }

      if (typeof shadow.offsetX !== 'number') {
        console.warn(`Config validation: config.shade.text.shadow.offsetX must be a number, got ${shadow.offsetX}. Using default: 4`);
        allValid = false;
      }

      if (typeof shadow.offsetY !== 'number') {
        console.warn(`Config validation: config.shade.text.shadow.offsetY must be a number, got ${shadow.offsetY}. Using default: 4`);
        allValid = false;
      }

      if (typeof shadow.color !== 'string' || shadow.color.trim() === '') {
        console.warn('Config validation: config.shade.text.shadow.color must be a non-empty string. Using default: "rgba(0, 0, 0, 0.6)"');
        allValid = false;
      }
    }
  }

  // Validate timing config
  if (shade.timing) {
    const timing = shade.timing;

    // Validate readingSpeedMsPerWord (100-500ms range)
    if (typeof timing.readingSpeedMsPerWord !== 'number' || timing.readingSpeedMsPerWord < 100 || timing.readingSpeedMsPerWord > 500) {
      console.warn(`Config validation: config.shade.timing.readingSpeedMsPerWord must be between 100 and 500, got ${timing.readingSpeedMsPerWord}. Using default: 200`);
      allValid = false;
    }

    // Validate minHoldMs (1000-10000ms range)
    if (typeof timing.minHoldMs !== 'number' || timing.minHoldMs < 1000 || timing.minHoldMs > 10000) {
      console.warn(`Config validation: config.shade.timing.minHoldMs must be between 1000 and 10000, got ${timing.minHoldMs}. Using default: 3000`);
      allValid = false;
    }

    // Validate scrollSpeedPxPerSec (positive number)
    if (typeof timing.scrollSpeedPxPerSec !== 'number' || timing.scrollSpeedPxPerSec <= 0) {
      console.warn(`Config validation: config.shade.timing.scrollSpeedPxPerSec must be > 0, got ${timing.scrollSpeedPxPerSec}. Using default: 300`);
      allValid = false;
    }
  }

  // Validate durations
  if (shade.durations) {
    const durations = shade.durations;

    if (typeof durations.entryMs !== 'number' || durations.entryMs < 100 || durations.entryMs > 10000) {
      console.warn(`Config validation: config.shade.durations.entryMs must be between 100 and 10000, got ${durations.entryMs}. Using default: 1000`);
      allValid = false;
    }

    if (typeof durations.exitMs !== 'number' || durations.exitMs < 100 || durations.exitMs > 10000) {
      console.warn(`Config validation: config.shade.durations.exitMs must be between 100 and 10000, got ${durations.exitMs}. Using default: 1000`);
      allValid = false;
    }
  }

  return allValid;
}

/**
 * Validate performance configuration section with graceful degradation
 * @param {Object} config - Full configuration object
 * @returns {boolean} True if all validations pass, false if any warnings logged
 */
export function validatePerformanceConfig(config) {
  // Check config.performance exists
  if (!config.performance) {
    console.warn('Config validation: config.performance section missing. Performance features may not work correctly.');
    return false;
  }

  let allValid = true;
  const perf = config.performance;

  // Validate alpha settings
  if (perf.alpha) {
    if (typeof perf.alpha.background !== 'boolean') {
      console.warn('Config validation: config.performance.alpha.background must be boolean. Using default: true');
      allValid = false;
    }
    if (typeof perf.alpha.stinger !== 'boolean') {
      console.warn('Config validation: config.performance.alpha.stinger must be boolean. Using default: true');
      allValid = false;
    }
    if (typeof perf.alpha.sidebar !== 'boolean') {
      console.warn('Config validation: config.performance.alpha.sidebar must be boolean. Using default: true');
      allValid = false;
    }

    // Check for incompatibilities: alpha disabled but opacity animations configured
    if (perf.alpha.background === false && config.background?.opacity) {
      console.warn('Config validation: Alpha disabled for background but opacity animations configured in config.background.opacity. Visual artifacts may occur.');
      allValid = false;
    }
    if (perf.alpha.stinger === false && config.stinger?.opacity) {
      console.warn('Config validation: Alpha disabled for stinger but opacity animations configured in config.stinger.opacity. Visual artifacts may occur.');
      allValid = false;
    }
    if (perf.alpha.sidebar === false && config.sidebar?.opacity) {
      console.warn('Config validation: Alpha disabled for sidebar but opacity animations configured in config.sidebar.opacity. Visual artifacts may occur.');
      allValid = false;
    }
  }

  // Validate thresholds
  if (perf.thresholds) {
    const t = perf.thresholds;

    // maxMemoryMB: > 0 and <= 1000
    if (typeof t.maxMemoryMB !== 'number' || t.maxMemoryMB <= 0 || t.maxMemoryMB > 1000) {
      console.warn(`Config validation: config.performance.thresholds.maxMemoryMB must be between 0 and 1000, got ${t.maxMemoryMB}. Using default: 300`);
      allValid = false;
    }

    // minFPS: > 0 and <= targetFPS
    if (typeof t.minFPS !== 'number' || t.minFPS <= 0) {
      console.warn(`Config validation: config.performance.thresholds.minFPS must be > 0, got ${t.minFPS}. Using default: 55`);
      allValid = false;
    }

    // targetFPS: typically 60 or 30
    if (typeof t.targetFPS !== 'number' || t.targetFPS <= 0) {
      console.warn(`Config validation: config.performance.thresholds.targetFPS must be > 0, got ${t.targetFPS}. Using default: 60`);
      allValid = false;
    }

    // minFPS should not exceed targetFPS
    if (typeof t.minFPS === 'number' && typeof t.targetFPS === 'number' && t.minFPS > t.targetFPS) {
      console.warn(`Config validation: config.performance.thresholds.minFPS (${t.minFPS}) exceeds targetFPS (${t.targetFPS}). minFPS should be <= targetFPS.`);
      allValid = false;
    }

    // maxContinuousHours: > 0
    if (typeof t.maxContinuousHours !== 'number' || t.maxContinuousHours <= 0) {
      console.warn(`Config validation: config.performance.thresholds.maxContinuousHours must be > 0, got ${t.maxContinuousHours}. Using default: 8`);
      allValid = false;
    }

    // frameTimeBudgetMs: should equal 1000 / targetFPS (with 0.1ms tolerance)
    if (typeof t.frameTimeBudgetMs === 'number' && typeof t.targetFPS === 'number') {
      const expectedBudget = 1000 / t.targetFPS;
      const diff = Math.abs(t.frameTimeBudgetMs - expectedBudget);
      if (diff > 0.1) {
        console.warn(`Config validation: config.performance.thresholds.frameTimeBudgetMs (${t.frameTimeBudgetMs}) does not match 1000 / targetFPS (${expectedBudget}). Expected: ${expectedBudget.toFixed(2)}ms`);
        allValid = false;
      }
    }
  }

  // Validate dirtyRectangles
  if (perf.dirtyRectangles) {
    const dr = perf.dirtyRectangles;

    if (typeof dr.enabled !== 'boolean') {
      console.warn('Config validation: config.performance.dirtyRectangles.enabled must be boolean. Using default: false');
      allValid = false;
    }

    if (typeof dr.safetyMargin !== 'number' || dr.safetyMargin < 0 || dr.safetyMargin > 50) {
      console.warn(`Config validation: config.performance.dirtyRectangles.safetyMargin must be between 0 and 50, got ${dr.safetyMargin}. Using default: 5`);
      allValid = false;
    }

    if (typeof dr.visualize !== 'boolean') {
      console.warn('Config validation: config.performance.dirtyRectangles.visualize must be boolean. Using default: false');
      allValid = false;
    }
  }

  // Validate overlay
  if (perf.overlay) {
    const o = perf.overlay;
    const validPositions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

    if (!validPositions.includes(o.position)) {
      console.warn(`Config validation: config.performance.overlay.position must be one of ${validPositions.join(', ')}, got "${o.position}". Using default: "top-right"`);
      allValid = false;
    }

    if (typeof o.opacity !== 'number' || o.opacity < 0 || o.opacity > 1) {
      console.warn(`Config validation: config.performance.overlay.opacity must be between 0 and 1, got ${o.opacity}. Using default: 0.9`);
      allValid = false;
    }

    if (typeof o.updateIntervalMs !== 'number' || o.updateIntervalMs <= 0) {
      console.warn(`Config validation: config.performance.overlay.updateIntervalMs must be > 0, got ${o.updateIntervalMs}. Using default: 100`);
      allValid = false;
    }
  }

  // Validate monitoring
  if (perf.monitoring) {
    const m = perf.monitoring;

    if (typeof m.enabled !== 'boolean') {
      console.warn('Config validation: config.performance.monitoring.enabled must be boolean. Using default: false');
      allValid = false;
    }

    if (typeof m.sampleSize !== 'number' || m.sampleSize <= 0 || m.sampleSize > 300) {
      console.warn(`Config validation: config.performance.monitoring.sampleSize must be between 0 and 300, got ${m.sampleSize}. Using default: 60`);
      allValid = false;
    }

    if (typeof m.sampleIntervalMs !== 'number' || m.sampleIntervalMs <= 0) {
      console.warn(`Config validation: config.performance.monitoring.sampleIntervalMs must be > 0, got ${m.sampleIntervalMs}. Using default: 1000`);
      allValid = false;
    }

    if (typeof m.logIntervalMs !== 'number' || m.logIntervalMs <= 0) {
      console.warn(`Config validation: config.performance.monitoring.logIntervalMs must be > 0, got ${m.logIntervalMs}. Using default: 2000`);
      allValid = false;
    }

    if (typeof m.sessionHistoryLimit !== 'number' || m.sessionHistoryLimit <= 0 || m.sessionHistoryLimit > 200) {
      console.warn(`Config validation: config.performance.monitoring.sessionHistoryLimit must be between 0 and 200, got ${m.sessionHistoryLimit}. Using default: 50`);
      allValid = false;
    }
  }

  return allValid;
}
