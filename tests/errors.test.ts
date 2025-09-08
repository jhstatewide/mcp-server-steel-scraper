import { SteelErrorCode, SteelDevError, createSteelError } from '../src/errors.js';

describe('SteelDevError', () => {
  it('should create a SteelDevError with correct properties', () => {
    const error = new SteelDevError(
      SteelErrorCode.NETWORK_UNAVAILABLE,
      'Network is unavailable',
      { url: 'https://example.com' },
      new Error('Original error')
    );

    expect(error.name).toBe('SteelDevError');
    expect(error.code).toBe(SteelErrorCode.NETWORK_UNAVAILABLE);
    expect(error.message).toBe('Network is unavailable');
    expect(error.metadata).toEqual({ url: 'https://example.com' });
    expect(error.originalError).toBeDefined();
  });

  it('should preserve stack trace', () => {
    const error = new SteelDevError(
      SteelErrorCode.UNKNOWN_ERROR,
      'Unknown error occurred'
    );

    expect(error.stack).toBeDefined();
  });

  it('should serialize to JSON correctly', () => {
    const originalError = new Error('Original error');
    const error = new SteelDevError(
      SteelErrorCode.CONTENT_TRUNCATED,
      'Content was truncated',
      { maxLength: 1000 },
      originalError
    );

    const json = error.toJSON();
    expect(json.name).toBe('SteelDevError');
    expect(json.code).toBe(SteelErrorCode.CONTENT_TRUNCATED);
    expect(json.message).toBe('Content was truncated');
    expect(json.metadata).toEqual({ maxLength: 1000 });
    expect(json.originalError).toBeDefined();
  });
});

describe('createSteelError', () => {
  it('should create a SteelDevError using the factory function', () => {
    const error = createSteelError(
      SteelErrorCode.AUTH_REQUIRED,
      'Authentication required',
      { method: 'GET' }
    );

    expect(error instanceof SteelDevError).toBe(true);
    expect(error.code).toBe(SteelErrorCode.AUTH_REQUIRED);
    expect(error.message).toBe('Authentication required');
    expect(error.metadata).toEqual({ method: 'GET' });
  });
});