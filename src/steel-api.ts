export interface ScrapeOptions {
  url: string;
  returnType?: "html" | "text" | "markdown" | "json";
  waitFor?: string;
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  maxLength?: number;
}

export interface ScrapeResult {
  success: boolean;
  data?: string;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  metadata?: {
    url: string;
    timestamp: string;
    returnType: string;
    processingTime?: number;
    contentLength?: number;
    returnedLength?: number;
    contentType?: string;
    method?: string;
    truncated?: boolean;
  };
}

export class SteelAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Ensure the base URL doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async scrapeWithBrowser(options: ScrapeOptions): Promise<ScrapeResult> {
    const {
      url,
      returnType = "html",
      waitFor,
      timeout = 30000,
      headers,
      userAgent,
      maxLength,
    } = options;

    try {
      // Prepare the request payload
      const payload: any = {
        url,
        returnType,
        timeout,
      };

      if (waitFor) {
        payload.waitFor = waitFor;
      }

      if (headers) {
        payload.headers = headers;
      }

      if (userAgent) {
        payload.userAgent = userAgent;
      }

      // Make the request to steel-dev API
      const response = await fetch(`${this.baseUrl}/v1/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.error || `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }

      const scrapedData = responseData.data || responseData.content || responseData;
      let finalData = typeof scrapedData === 'string' ? scrapedData : JSON.stringify(scrapedData);
      const originalLength = finalData.length;
      
      // Truncate if maxLength is specified and content exceeds it
      if (maxLength && finalData.length > maxLength) {
        finalData = finalData.substring(0, maxLength) + `\n\n[CONTENT TRUNCATED: ${originalLength} characters total, showing first ${maxLength} characters]`;
      }
      
      return {
        success: true,
        data: finalData,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          returnType,
          processingTime: responseData.processingTime,
          contentLength: originalLength,
          returnedLength: finalData.length,
          contentType: response.headers.get('content-type') || 'unknown',
          method: 'full-browser-automation',
          truncated: maxLength ? originalLength > maxLength : false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          returnType,
        },
      };
    }
  }

  // Health check method to verify API connectivity
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get API info/version
  async getInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: "GET",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get API info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
