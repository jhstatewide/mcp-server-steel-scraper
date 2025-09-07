export interface ScrapeOptions {
  url: string;
  returnType?: "html" | "text" | "markdown" | "json";
  waitFor?: string;
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  maxLength?: number;
  verboseMode?: boolean;
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
    warnings?: string[];
    verboseMode?: boolean;
  };
}

export class SteelAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Ensure the base URL doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getSmartDefaults(returnType: string): number {
    switch (returnType) {
      case "markdown": return 8000;
      case "text": return 10000;
      case "html": return 15000;
      case "json": return 5000;
      default: return 8000;
    }
  }

  private calculateContentLength(maxLength: number, returnType: string, verboseMode: boolean): number {
    if (returnType === "markdown") {
      // For markdown, reserve space for metadata
      const metadataReserve = verboseMode ? 0.15 : 0.1; // 15% for verbose, 10% for clean
      return Math.floor(maxLength * (1 - metadataReserve));
    }
    // For other types, use full length for content
    return maxLength;
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
      verboseMode = false,
    } = options;

    // Apply smart defaults if no maxLength specified
    const effectiveMaxLength = maxLength || this.getSmartDefaults(returnType);
    const contentLength = this.calculateContentLength(effectiveMaxLength, returnType, verboseMode);
    
    // Debug logging
    console.log(`[SteelAPI] Scraping ${url} with returnType=${returnType}, maxLength=${maxLength}, effectiveMaxLength=${effectiveMaxLength}, contentLength=${contentLength}`);

    try {
      // Prepare the request payload
      const payload: any = {
        url,
        returnType,
        timeout,
        maxLength: effectiveMaxLength, // Send the total length limit to steel-dev API
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
      
      // Debug logging
      console.log(`[SteelAPI] Received ${originalLength} characters from steel-dev API, requested ${contentLength}`);
      
      // Check for markdown conversion issues and collect warnings
      const warnings: string[] = [];
      if (returnType === "markdown") {
        // Detect if we got HTML instead of markdown (common conversion failure)
        const hasHtmlTags = finalData.includes('<html') || finalData.includes('<!DOCTYPE') || finalData.includes('<head>') || 
                           finalData.includes('<div') || finalData.includes('<span') || finalData.includes('<script');
        const hasMarkdownSyntax = finalData.includes('# ') || finalData.includes('## ') || finalData.includes('* ') || 
                                 finalData.includes('- ') || finalData.includes('[') && finalData.includes('](');
        
        if (hasHtmlTags && !hasMarkdownSyntax) {
          const warning = `Markdown conversion failed - received HTML content instead of markdown. The steel-dev API may not support markdown conversion for this page type. Try using returnType='text' for a simpler text extraction.`;
          warnings.push(warning);
          console.warn(`${warning} for ${url}`);
          console.warn(`[SteelAPI] HTML detected: ${hasHtmlTags}, Markdown detected: ${hasMarkdownSyntax}`);
        }
        
        // Check for truncated markdown that might be incomplete
        if (finalData.length > 0 && !finalData.trim().endsWith('.') && !finalData.trim().endsWith('!') && !finalData.trim().endsWith('?') && !finalData.trim().endsWith(']')) {
          // This is a heuristic - if content doesn't end with typical sentence endings or markdown elements,
          // it might be truncated mid-sentence
          if (finalData.length >= contentLength * 0.95) {
            const warning = `Markdown content may be truncated mid-sentence`;
            warnings.push(warning);
            console.warn(`${warning} for ${url}`);
          }
        }
        
        // Check for very short markdown content that might indicate conversion issues
        if (finalData.length < 100 && originalLength > 1000) {
          const warning = `Markdown content is unusually short compared to original content - conversion may have failed`;
          warnings.push(warning);
          console.warn(`${warning} for ${url}`);
        }
      }
      
      // Apply final truncation if content exceeds the effective max length
      if (finalData.length > effectiveMaxLength) {
        console.log(`[SteelAPI] Truncating content from ${finalData.length} to ${effectiveMaxLength} characters`);
        finalData = finalData.substring(0, effectiveMaxLength) + `\n\n[CONTENT TRUNCATED: ${originalLength} characters total, showing first ${effectiveMaxLength} characters]`;
      } else {
        console.log(`[SteelAPI] Content length ${finalData.length} is within limit ${effectiveMaxLength}`);
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
          truncated: originalLength > effectiveMaxLength,
          warnings: warnings.length > 0 ? warnings : undefined,
          verboseMode,
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
