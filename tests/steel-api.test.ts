import { SteelDevScraperService, SteelAPI } from '../src/steel-api';
import { SteelErrorCode } from '../src/errors';

// Mock fetch for testing
global.fetch = jest.fn();

describe('SteelDevScraperService', () => {
  let scraper: SteelDevScraperService;

  beforeEach(() => {
    scraper = new SteelDevScraperService('http://localhost:3000');
    (fetch as jest.Mock).mockClear();
  });

  describe('scrapeWithBrowser', () => {
    it('should handle network errors correctly', async () => {
      // Mock a network error
      (fetch as jest.Mock).mockRejectedValue(new TypeError('fetch failed'));

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com',
        format: ['markdown']
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SteelErrorCode.NETWORK_UNAVAILABLE);
      expect(result.error).toBeDefined();
    });

    it('should handle HTTP 404 errors correctly', async () => {
      // Mock a 404 response
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Page not found' })
      });

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com/missing',
        format: ['markdown']
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SteelErrorCode.CLIENT_ERROR);
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe('Page not found');
    });

    it('should handle HTTP 500 errors correctly', async () => {
      // Mock a 500 response
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Internal server error' })
      });

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com/error',
        format: ['markdown']
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SteelErrorCode.SERVER_ERROR);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle rate limit errors correctly', async () => {
      // Mock a 429 response
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' })
      });

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com/rate-limited',
        format: ['markdown']
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SteelErrorCode.RATE_LIMIT_EXCEEDED);
      expect(result.statusCode).toBe(429);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle successful responses correctly', async () => {
      // Mock a successful response
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          content: { markdown: '# Test Content' },
          metadata: { timestamp: '2023-01-01T00:00:00Z' },
          processingTime: 100
        })
      });

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com',
        format: ['markdown']
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('# Test Content');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful health checks', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      const result = await scraper.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false for failed health checks', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false
      });

      const result = await scraper.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should handle errors in getInfo correctly', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(scraper.getInfo()).rejects.toThrow();
    });
  });
});

describe('SteelAPI', () => {
  let scraper: SteelAPI;

  beforeEach(() => {
    scraper = new SteelAPI('http://localhost:3000');
    (fetch as jest.Mock).mockClear();
  });

  describe('scrapeWithBrowser', () => {
    it('should handle network errors correctly', async () => {
      // Mock a network error
      (fetch as jest.Mock).mockRejectedValue(new TypeError('fetch failed'));

      const result = await scraper.scrapeWithBrowser({
        url: 'https://example.com',
        format: ['markdown']
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SteelErrorCode.NETWORK_UNAVAILABLE);
      expect(result.error).toBeDefined();
    });
  });
});