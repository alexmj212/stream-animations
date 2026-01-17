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
  isDevMode,
  getSpeedFromURL,
  getDensityFromURL,
  getDurationFromURL
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
