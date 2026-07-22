/**
 * Tests for configuration validation functions
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateConfig,
  validateNumber,
  validateNumberInRange,
  validatePositiveNumber,
  validateProbability,
  validateDurations,
  validateBrightness,
  validateEasingFunction,
  validateSidebarPositioning,
  validateShadeConfig,
  validateEpcotConfig,
  isDevMode,
  getSpeedFromURL,
  getDensityFromURL,
  getDurationFromURL,
  getSizeFromURL,
  getPatternFromURL,
  getBrightnessFromURL
} from './validation.js';

describe('validateConfig', () => {
  it('should return defaults when user config is empty', () => {
    const defaults = { a: 1, b: 2, c: { d: 3 } };
    const result = validateConfig({}, defaults);
    expect(result).toEqual(defaults);
  });

  it('should validate nested objects recursively', () => {
    const defaults = { a: 1, b: { c: 2, d: 3 } };
    const userConfig = { a: 5, b: { c: 10 } };
    const result = validateConfig(userConfig, defaults);
    expect(result).toEqual({ a: 5, b: { c: 10, d: 3 } });
  });

  it('should use default on type mismatch', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const defaults = { a: 1, b: 'test' };
    const userConfig = { a: 'string', b: 123 };
    const result = validateConfig(userConfig, defaults);
    expect(result).toEqual(defaults);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });

  it('should validate numbers with range checks', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const defaults = { speed: 1.0 };
    const userConfig = { speed: -5 };
    const result = validateConfig(userConfig, defaults);
    expect(result.speed).toBe(1.0);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('should accept valid user values', () => {
    const defaults = { a: 1, b: 'test', c: true };
    const userConfig = { a: 100, b: 'custom', c: false };
    const result = validateConfig(userConfig, defaults);
    expect(result).toEqual(userConfig);
  });
});

describe('validateNumber', () => {
  it('should return valid numbers unchanged', () => {
    expect(validateNumber(5, 10)).toBe(5);
    expect(validateNumber(0, 10)).toBe(0);
    expect(validateNumber(100, 10)).toBe(100);
  });

  it('should use default for non-finite numbers', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateNumber(NaN, 10)).toBe(10);
    expect(validateNumber(Infinity, 10)).toBe(10);
    expect(validateNumber(-Infinity, 10)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    consoleWarnSpy.mockRestore();
  });

  it('should use default for non-number types', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateNumber('5', 10)).toBe(10);
    expect(validateNumber(null, 10)).toBe(10);
    expect(validateNumber(undefined, 10)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    consoleWarnSpy.mockRestore();
  });

  it('should enforce minimum range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateNumber(-5, 10, 'test', 0, 100)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('should enforce maximum range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateNumber(150, 10, 'test', 0, 100)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

describe('validateNumberInRange', () => {
  it('should validate numbers within range', () => {
    expect(validateNumberInRange(5, 10, 0, 100)).toBe(5);
    expect(validateNumberInRange(0, 10, 0, 100)).toBe(0);
    expect(validateNumberInRange(100, 10, 0, 100)).toBe(100);
  });

  it('should use default for out-of-range values', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateNumberInRange(-1, 10, 0, 100)).toBe(10);
    expect(validateNumberInRange(101, 10, 0, 100)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });
});

describe('validatePositiveNumber', () => {
  it('should accept positive numbers', () => {
    expect(validatePositiveNumber(1, 10)).toBe(1);
    expect(validatePositiveNumber(0.1, 10)).toBe(0.1);
    expect(validatePositiveNumber(100, 10)).toBe(100);
  });

  it('should reject zero and negative numbers', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validatePositiveNumber(0, 10)).toBe(10);
    expect(validatePositiveNumber(-5, 10)).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });
});

describe('validateProbability', () => {
  it('should accept values between 0 and 1', () => {
    expect(validateProbability(0, 0.5)).toBe(0);
    expect(validateProbability(0.5, 0.5)).toBe(0.5);
    expect(validateProbability(1, 0.5)).toBe(1);
  });

  it('should reject values outside 0-1 range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateProbability(-0.1, 0.5)).toBe(0.5);
    expect(validateProbability(1.1, 0.5)).toBe(0.5);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });
});

describe('isDevMode', () => {
  it('should return false in Node environment', () => {
    expect(isDevMode()).toBe(false);
  });

  it('should detect perf=true query parameter', () => {
    // Mock window and URLSearchParams
    global.window = {
      location: {
        search: '?perf=true'
      }
    };

    expect(isDevMode()).toBe(true);

    delete global.window;
  });

  it('should return false when perf parameter is not true', () => {
    global.window = {
      location: {
        search: '?perf=false'
      }
    };

    expect(isDevMode()).toBe(false);

    delete global.window;
  });
});

describe('getSpeedFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getSpeedFromURL(1.5)).toBe(1.5);
  });

  it('should parse valid speed parameter', () => {
    global.window = {
      location: {
        search: '?speed=2.5'
      }
    };

    expect(getSpeedFromURL(1.0)).toBe(2.5);

    delete global.window;
  });

  it('should use default for invalid speed', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?speed=-1'
      }
    };

    expect(getSpeedFromURL(1.0)).toBe(1.0);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('getBrightnessFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getBrightnessFromURL(1.0)).toBe(1.0);
  });

  it('should parse valid brightness parameter', () => {
    global.window = {
      location: {
        search: '?brightness=1.8'
      }
    };

    expect(getBrightnessFromURL(1.0)).toBe(1.8);

    delete global.window;
  });

  it('should use default for invalid brightness', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?brightness=-2'
      }
    };

    expect(getBrightnessFromURL(1.0)).toBe(1.0);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('getSizeFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getSizeFromURL(90, 20, 300)).toBe(90);
  });

  it('should parse valid size parameter', () => {
    global.window = {
      location: {
        search: '?size=120'
      }
    };

    expect(getSizeFromURL(90, 20, 300)).toBe(120);

    delete global.window;
  });

  it('should use default for out-of-range size', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?size=5000'
      }
    };

    expect(getSizeFromURL(90, 20, 300)).toBe(90);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('getPatternFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getPatternFromURL('chase', ['chase', 'pulse', 'diagonal'])).toBe('chase');
  });

  it('should parse a valid pattern parameter', () => {
    global.window = {
      location: {
        search: '?pattern=pulse'
      }
    };

    expect(getPatternFromURL('chase', ['chase', 'pulse', 'diagonal'])).toBe('pulse');

    delete global.window;
  });

  it('should use default for an unknown pattern name', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?pattern=nonexistent'
      }
    };

    expect(getPatternFromURL('chase', ['chase', 'pulse', 'diagonal'])).toBe('chase');
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('getDensityFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getDensityFromURL(20, 1, 50)).toBe(20);
  });

  it('should parse valid density parameter', () => {
    global.window = {
      location: {
        search: '?density=25'
      }
    };

    expect(getDensityFromURL(15, 1, 50)).toBe(25);

    delete global.window;
  });

  it('should use default for out-of-range density', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?density=100'
      }
    };

    expect(getDensityFromURL(15, 1, 50)).toBe(15);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('getDurationFromURL', () => {
  it('should return default in Node environment', () => {
    expect(getDurationFromURL(2000)).toBe(2000);
  });

  it('should parse valid duration parameter', () => {
    global.window = {
      location: {
        search: '?duration=1500'
      }
    };

    expect(getDurationFromURL(1000)).toBe(1500);

    delete global.window;
  });

  it('should use default for invalid duration', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.window = {
      location: {
        search: '?duration=-500'
      }
    };

    expect(getDurationFromURL(1000)).toBe(1000);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    delete global.window;
  });
});

describe('duration validation', () => {
  it('validateDurations accepts valid millisecond values', () => {
    const durations = { defaultMs: 1000, entryMs: 1500, exitMs: 800, holdMs: 2000 };
    const defaults = { defaultMs: 1000, entryMs: 1000, exitMs: 1000, holdMs: 2000 };
    const result = validateDurations(durations, defaults);
    expect(result).toEqual(durations);
  });

  it('validateDurations accepts valid background-specific values', () => {
    const durations = { entryMs: 2000, exitMs: 2000, holdMinMs: 30000, holdMaxMs: 120000, transitionMs: 3000 };
    const defaults = { entryMs: 2000, exitMs: 2000, holdMinMs: 30000, holdMaxMs: 120000, transitionMs: 3000 };
    const result = validateDurations(durations, defaults);
    expect(result).toEqual(durations);
  });

  it('validateDurations clamps values outside range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const durations = { defaultMs: 50, entryMs: 20000, exitMs: 1000, holdMs: 50000 };
    const defaults = { defaultMs: 1000, entryMs: 1000, exitMs: 1000, holdMs: 2000 };
    const result = validateDurations(durations, defaults);

    expect(result.defaultMs).toBe(1000); // 50 < min(100)
    expect(result.entryMs).toBe(1000);   // 20000 > max(10000)
    expect(result.exitMs).toBe(1000);    // valid, passed through
    expect(result.holdMs).toBe(2000);    // 50000 > max(30000)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);

    consoleWarnSpy.mockRestore();
  });

  it('validateDurations returns defaults for invalid input', () => {
    const defaults = { defaultMs: 1000, entryMs: 1000, exitMs: 1000, holdMs: 2000 };
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(validateDurations(null, defaults)).toEqual(defaults);
    expect(validateDurations('invalid', defaults)).toEqual(defaults);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });

  it('validateDurations handles partial objects', () => {
    const durations = { entryMs: 1500 };
    const defaults = { defaultMs: 1000, entryMs: 1000, exitMs: 1000, holdMs: 2000 };
    const result = validateDurations(durations, defaults);

    expect(result.entryMs).toBe(1500);
    expect(result.defaultMs).toBeUndefined();
    expect(result.exitMs).toBeUndefined();
    expect(result.holdMs).toBeUndefined();
  });
});

describe('brightness validation', () => {
  it('validateBrightness accepts values in 0-1 range', () => {
    expect(validateBrightness(0.8, 0.8, 'test')).toBe(0.8);
    expect(validateBrightness(0, 0.8, 'test')).toBe(0);
    expect(validateBrightness(1, 0.8, 'test')).toBe(1);
    expect(validateBrightness(0.5, 0.8, 'test')).toBe(0.5);
  });

  it('validateBrightness clamps values outside 0-1', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateBrightness(-0.5, 0.8, 'test')).toBe(0.8); // < 0
    expect(validateBrightness(1.5, 0.8, 'test')).toBe(0.8);  // > 1
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });

  it('validateBrightness returns default for non-numeric input', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateBrightness('0.8', 0.8, 'test')).toBe(0.8);
    expect(validateBrightness(null, 0.8, 'test')).toBe(0.8);
    expect(validateBrightness(undefined, 0.8, 'test')).toBe(0.8);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);

    consoleWarnSpy.mockRestore();
  });
});

describe('easing function validation', () => {
  it('validateEasingFunction accepts valid string', () => {
    expect(validateEasingFunction('easeInOutCubic')).toBe('easeInOutCubic');
    expect(validateEasingFunction('linear')).toBe('linear');
    expect(validateEasingFunction('easeInQuad')).toBe('easeInQuad');
  });

  it('validateEasingFunction returns default for invalid input', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateEasingFunction('')).toBe('easeInOutCubic');
    expect(validateEasingFunction('   ')).toBe('easeInOutCubic');
    expect(validateEasingFunction(null)).toBe('easeInOutCubic');
    expect(validateEasingFunction(123)).toBe('easeInOutCubic');
    expect(validateEasingFunction(undefined)).toBe('easeInOutCubic');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(5);

    consoleWarnSpy.mockRestore();
  });

  it('validateEasingFunction accepts custom default', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateEasingFunction('', 'linear')).toBe('linear');
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});

describe('sidebar positioning validation', () => {
  it('validateSidebarPositioning accepts valid percentages', () => {
    const position = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -100 };
    const result = validateSidebarPositioning(position, position);
    expect(result).toEqual(position);
  });

  it('validateSidebarPositioning accepts edge case values', () => {
    const position = { sidebarStart: 0.0, sidebarWidth: 1.0, horizontalTargetOffset: 0 };
    const result = validateSidebarPositioning(position, position);
    expect(result.sidebarStart).toBe(0.0);
    expect(result.sidebarWidth).toBe(1.0);
    expect(result.horizontalTargetOffset).toBe(0);
  });

  it('validateSidebarPositioning warns when sidebar exceeds viewport', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const position = { sidebarStart: 0.9, sidebarWidth: 0.3, horizontalTargetOffset: 0 };
    const defaults = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -100 };

    const result = validateSidebarPositioning(position, defaults);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds viewport')
    );
    expect(result.sidebarStart).toBe(0.9);
    expect(result.sidebarWidth).toBe(0.3);

    consoleWarnSpy.mockRestore();
  });

  it('validateSidebarPositioning clamps values outside 0-1', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const position = { sidebarStart: 1.5, sidebarWidth: -0.2, horizontalTargetOffset: -100 };
    const defaults = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -100 };

    const result = validateSidebarPositioning(position, defaults);

    expect(result.sidebarStart).toBe(0.8);  // 1.5 > 1
    expect(result.sidebarWidth).toBe(0.2);  // -0.2 < 0
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });

  it('validateSidebarPositioning clamps horizontalTargetOffset', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const position = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -2000 };
    const defaults = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -100 };

    const result = validateSidebarPositioning(position, defaults);

    expect(result.horizontalTargetOffset).toBe(-100); // -2000 < -1000
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('validateSidebarPositioning returns defaults for invalid input', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const defaults = { sidebarStart: 0.8, sidebarWidth: 0.2, horizontalTargetOffset: -100 };

    expect(validateSidebarPositioning(null, defaults)).toEqual(defaults);
    expect(validateSidebarPositioning('invalid', defaults)).toEqual(defaults);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

    consoleWarnSpy.mockRestore();
  });
});

describe('shade config validation', () => {
  const validShadeConfig = {
    brightness: 0.8,
    text: {
      font: 'bold 96px Jost',
      color: '#ffffff',
      shadow: {
        blur: 8,
        offsetX: 4,
        offsetY: 4,
        color: 'rgba(0, 0, 0, 0.6)'
      }
    },
    timing: {
      readingSpeedMsPerWord: 200,
      minHoldMs: 3000,
      scrollSpeedPxPerSec: 300
    },
    durations: {
      entryMs: 1000,
      exitMs: 1000
    }
  };

  it('validateShadeConfig accepts valid config', () => {
    const result = validateShadeConfig(validShadeConfig);
    expect(result).toBe(true);
  });

  it('validateShadeConfig returns false for missing config', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateShadeConfig(null)).toBe(false);
    expect(validateShadeConfig(undefined)).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates brightness range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validShadeConfig, brightness: 1.5 };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('brightness must be between 0 and 1')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates font string', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validShadeConfig, text: { ...validShadeConfig.text, font: '' } };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('text.font must be a non-empty string')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates shadow properties', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      ...validShadeConfig,
      text: {
        ...validShadeConfig.text,
        shadow: {
          blur: -5,
          offsetX: 4,
          offsetY: 4,
          color: 'rgba(0, 0, 0, 0.6)'
        }
      }
    };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('shadow.blur must be >= 0')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates readingSpeedMsPerWord range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      ...validShadeConfig,
      timing: { ...validShadeConfig.timing, readingSpeedMsPerWord: 50 }
    };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('readingSpeedMsPerWord must be between 100 and 500')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates minHoldMs range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      ...validShadeConfig,
      timing: { ...validShadeConfig.timing, minHoldMs: 500 }
    };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('minHoldMs must be between 1000 and 10000')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates scrollSpeedPxPerSec positive', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      ...validShadeConfig,
      timing: { ...validShadeConfig.timing, scrollSpeedPxPerSec: -100 }
    };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('scrollSpeedPxPerSec must be > 0')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateShadeConfig validates durations', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = {
      ...validShadeConfig,
      durations: { entryMs: 50, exitMs: 20000 }
    };
    const result = validateShadeConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });
});

describe('epcot config validation', () => {
  const validEpcotConfig = {
    size: { default: 90, min: 20, max: 300 },
    spikeHeightRatio: 0.35,
    spikeVariation: 0.15,
    cycleDuration: 24,
    lighting: {
      zHeightRatio: 0.35,
      falloffRatio: 0.45,
      cornerMargin: 0.05,
      shininess: 24,
      ambient: 0.08,
      intensity: 1.0,
      hueOffsets: [-20, 0, 20, 40]
    },
    pattern: { default: 'chase', options: ['chase', 'pulse', 'diagonal'] },
    color: { defaultHex: '#1c6f8c' }
  };

  it('validateEpcotConfig accepts valid config', () => {
    const result = validateEpcotConfig(validEpcotConfig);
    expect(result).toBe(true);
  });

  it('validateEpcotConfig returns false for missing config', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateEpcotConfig(null)).toBe(false);
    expect(validateEpcotConfig(undefined)).toBe(false);
    consoleWarnSpy.mockRestore();
  });

  it('validateEpcotConfig validates spikeHeightRatio range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validEpcotConfig, spikeHeightRatio: 1.5 };
    const result = validateEpcotConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('spikeHeightRatio must be between 0 and 1')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateEpcotConfig validates cycleDuration is positive', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validEpcotConfig, cycleDuration: -5 };
    const result = validateEpcotConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('cycleDuration must be > 0')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateEpcotConfig validates lighting.ambient range', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validEpcotConfig, lighting: { ...validEpcotConfig.lighting, ambient: 2 } };
    const result = validateEpcotConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ambient must be between 0 and 1')
    );
    consoleWarnSpy.mockRestore();
  });

  it('validateEpcotConfig validates pattern.default is one of pattern.options', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = { ...validEpcotConfig, pattern: { default: 'spiral', options: ['chase', 'pulse', 'diagonal'] } };
    const result = validateEpcotConfig(config);
    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('pattern.default must be one of')
    );
    consoleWarnSpy.mockRestore();
  });
});
