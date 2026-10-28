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
 * Parse and validate triangle side length from URL parameter
 * @param {number} defaultValue - Default size in pixels
 * @param {number} min - Minimum allowed size
 * @param {number} max - Maximum allowed size
 * @returns {number} Validated size
 */
export function getSizeFromURL(defaultValue = 90, min = 70, max = 300) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const sizeParam = urlParams.get('size');

  if (sizeParam === null) return defaultValue;

  const size = parseFloat(sizeParam);
  return validateNumberInRange(size, defaultValue, min, max, 'URL parameter size');
}

/**
 * Parse and validate a brightness multiplier from URL parameter
 * @param {number} defaultValue - Default brightness multiplier
 * @returns {number} Validated brightness multiplier
 */
export function getBrightnessFromURL(defaultValue = 1.0) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const brightnessParam = urlParams.get('brightness');

  if (brightnessParam === null) return defaultValue;

  const brightness = parseFloat(brightnessParam);
  return validatePositiveNumber(brightness, defaultValue, 'URL parameter brightness');
}

/**
 * Parse and validate the panel gap line width from URL parameter
 * @param {number} defaultValue - Default gap width in pixels
 * @returns {number} Validated gap width
 */
export function getGapWidthFromURL(defaultValue = 1.5) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const gapParam = urlParams.get('gap');

  if (gapParam === null) return defaultValue;

  const gap = parseFloat(gapParam);
  return validateNumberInRange(gap, defaultValue, 0, 20, 'URL parameter gap');
}

/**
 * Parse and validate a light pattern name from URL parameter
 * @param {string} defaultValue - Default pattern name
 * @param {string[]} validPatterns - Allowed pattern names
 * @returns {string} Validated pattern name
 */
export function getPatternFromURL(defaultValue = 'chase', validPatterns = ['chase', 'pulse', 'diagonal']) {
  if (typeof window === 'undefined') return defaultValue;

  const urlParams = new URLSearchParams(window.location.search);
  const patternParam = urlParams.get('pattern');

  if (patternParam === null) return defaultValue;

  if (!validPatterns.includes(patternParam)) {
    console.warn(
      `Config validation: URL parameter pattern must be one of ${validPatterns.join(', ')}, got "${patternParam}". Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return patternParam;
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

    // Validate color string
    if (typeof text.color !== 'string' || text.color.trim() === '') {
      console.warn('Config validation: config.shade.text.color must be a non-empty string. Using default: "#ffffff"');
      allValid = false;
    }

    // Validate line height (em)
    if (typeof text.lineHeight !== 'number' || text.lineHeight < 1 || text.lineHeight > 2) {
      console.warn(`Config validation: config.shade.text.lineHeight must be between 1 and 2, got ${text.lineHeight}. Using default: 1.15`);
      allValid = false;
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

  }

  // Validate the curtains' close/open time
  if (typeof shade.curtainMoveMs !== 'number' || shade.curtainMoveMs < 100 || shade.curtainMoveMs > 2000) {
    console.warn(`Config validation: config.shade.curtainMoveMs must be between 100 and 2000, got ${shade.curtainMoveMs}. Using default: 500`);
    allValid = false;
  }

  return allValid;
}

/**
 * Validate epcot scene configuration
 * @param {object} epcot - Epcot config section
 * @returns {boolean} True if all validations pass, false if any warnings logged
 */
export function validateEpcotConfig(epcot) {
  if (!epcot || typeof epcot !== 'object') {
    console.warn('Config validation: config.epcot section missing or invalid. Epcot scene may not work correctly.');
    return false;
  }

  let allValid = true;

  if (epcot.size) {
    const size = epcot.size;
    if (typeof size.default !== 'number' || size.default <= 0) {
      console.warn(`Config validation: config.epcot.size.default must be > 0, got ${size.default}. Using default: 90`);
      allValid = false;
    }
    if (typeof size.min !== 'number' || typeof size.max !== 'number' || size.min >= size.max) {
      console.warn(`Config validation: config.epcot.size.min (${size.min}) must be less than size.max (${size.max}).`);
      allValid = false;
    }
  }

  if (typeof epcot.spikeHeightRatio !== 'number' || epcot.spikeHeightRatio <= 0 || epcot.spikeHeightRatio > 1) {
    console.warn(`Config validation: config.epcot.spikeHeightRatio must be between 0 and 1, got ${epcot.spikeHeightRatio}. Using default: 0.35`);
    allValid = false;
  }

  if (typeof epcot.spikeVariation !== 'number' || epcot.spikeVariation < 0 || epcot.spikeVariation > 1) {
    console.warn(`Config validation: config.epcot.spikeVariation must be between 0 and 1, got ${epcot.spikeVariation}. Using default: 0.15`);
    allValid = false;
  }

  if (typeof epcot.cycleDuration !== 'number' || epcot.cycleDuration <= 0) {
    console.warn(`Config validation: config.epcot.cycleDuration must be > 0, got ${epcot.cycleDuration}. Using default: 24`);
    allValid = false;
  }

  if (epcot.lighting) {
    const lighting = epcot.lighting;

    if (typeof lighting.shininess !== 'number' || lighting.shininess <= 0) {
      console.warn(`Config validation: config.epcot.lighting.shininess must be > 0, got ${lighting.shininess}. Using default: 24`);
      allValid = false;
    }

    if (typeof lighting.ambient !== 'number' || lighting.ambient < 0 || lighting.ambient > 1) {
      console.warn(`Config validation: config.epcot.lighting.ambient must be between 0 and 1, got ${lighting.ambient}. Using default: 0.08`);
      allValid = false;
    }

    if (typeof lighting.vertexHeightRatio !== 'number' || lighting.vertexHeightRatio <= 0) {
      console.warn(`Config validation: config.epcot.lighting.vertexHeightRatio must be > 0, got ${lighting.vertexHeightRatio}. Using default: 0.5`);
      allValid = false;
    }

    if (typeof lighting.falloffSizeRatio !== 'number' || lighting.falloffSizeRatio <= 0) {
      console.warn(`Config validation: config.epcot.lighting.falloffSizeRatio must be > 0, got ${lighting.falloffSizeRatio}. Using default: 1.0`);
      allValid = false;
    }

    if (typeof lighting.cornerWeightFalloffRatio !== 'number' || lighting.cornerWeightFalloffRatio <= 0 || lighting.cornerWeightFalloffRatio > 1) {
      console.warn(`Config validation: config.epcot.lighting.cornerWeightFalloffRatio must be between 0 and 1, got ${lighting.cornerWeightFalloffRatio}. Using default: 0.09`);
      allValid = false;
    }

    if (!Array.isArray(lighting.hueOffsets) || lighting.hueOffsets.length !== 4) {
      console.warn('Config validation: config.epcot.lighting.hueOffsets must be an array of 4 numbers. Using default: [-20, 0, 20, 40]');
      allValid = false;
    }
  }

  if (epcot.gap) {
    const gap = epcot.gap;

    if (typeof gap.enabled !== 'boolean') {
      console.warn('Config validation: config.epcot.gap.enabled must be boolean. Using default: true');
      allValid = false;
    }

    if (typeof gap.width !== 'number' || gap.width < 0) {
      console.warn(`Config validation: config.epcot.gap.width must be >= 0, got ${gap.width}. Using default: 1.5`);
      allValid = false;
    }

    if (typeof gap.internalWidthRatio !== 'number' || gap.internalWidthRatio < 0 || gap.internalWidthRatio > 1) {
      console.warn(`Config validation: config.epcot.gap.internalWidthRatio must be between 0 and 1, got ${gap.internalWidthRatio}. Using default: 0.6`);
      allValid = false;
    }

    if (typeof gap.lightnessRatio !== 'number' || gap.lightnessRatio < 0 || gap.lightnessRatio > 1) {
      console.warn(`Config validation: config.epcot.gap.lightnessRatio must be between 0 and 1, got ${gap.lightnessRatio}. Using default: 0.15`);
      allValid = false;
    }
  }

  if (epcot.vertexDots) {
    const dots = epcot.vertexDots;

    if (typeof dots.enabled !== 'boolean') {
      console.warn('Config validation: config.epcot.vertexDots.enabled must be boolean. Using default: true');
      allValid = false;
    }

    if (typeof dots.size !== 'number' || dots.size <= 0) {
      console.warn(`Config validation: config.epcot.vertexDots.size must be > 0, got ${dots.size}. Using default: 1.5`);
      allValid = false;
    }

    if (typeof dots.intensityThreshold !== 'number' || dots.intensityThreshold < 0 || dots.intensityThreshold > 1) {
      console.warn(`Config validation: config.epcot.vertexDots.intensityThreshold must be between 0 and 1, got ${dots.intensityThreshold}. Using default: 0.05`);
      allValid = false;
    }
  }

  if (epcot.pattern) {
    const validPatterns = Array.isArray(epcot.pattern.options) ? epcot.pattern.options : ['chase', 'pulse', 'diagonal'];
    if (typeof epcot.pattern.default !== 'string' || !validPatterns.includes(epcot.pattern.default)) {
      console.warn(`Config validation: config.epcot.pattern.default must be one of ${validPatterns.join(', ')}, got "${epcot.pattern.default}". Using default: "chase"`);
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
