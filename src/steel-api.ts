export interface ScrapeOptions {
  url: string;
  format?: ("html" | "readability" | "cleaned_html" | "markdown")[];
  screenshot?: boolean;
  pdf?: boolean;
  proxyUrl?: string;
  delay?: number;
  logUrl?: string;
  // MCP-specific enhancements
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
    format: string[];
    processingTime?: number;
    contentLength?: number;
    returnedLength?: number;
    contentType?: string;
    method?: string;
    truncated?: boolean;
    warnings?: string[];
    verboseMode?: boolean;
    // Official API metadata
    title?: string;
    description?: string;
    language?: string;
    ogImage?: string;
    ogTitle?: string;
    ogDescription?: string;
    publishedTimestamp?: string;
  };
  // Official API response fields
  screenshot?: string;
  pdf?: string;
  links?: Array<{ url: string; text: string }>;
}

export class SteelAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Ensure the base URL doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getSmartDefaults(formats: string[]): number {
    // Use the first format for smart defaults, or default to markdown
    const primaryFormat = formats[0] || "markdown";
    switch (primaryFormat) {
      case "markdown": return 8000;
      case "readability": return 10000;
      case "html": return 15000;
      case "cleaned_html": return 12000;
      default: return 8000;
    }
  }

  private calculateContentLength(maxLength: number, formats: string[], verboseMode: boolean): number {
    const primaryFormat = formats[0] || "markdown";
    if (primaryFormat === "markdown") {
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
      format = ["html"],
      screenshot = false,
      pdf = false,
      proxyUrl,
      delay,
      logUrl,
      maxLength,
      verboseMode = false,
    } = options;

    // Apply smart defaults if no maxLength specified
    const effectiveMaxLength = maxLength || this.getSmartDefaults(format);
    const contentLength = this.calculateContentLength(effectiveMaxLength, format, verboseMode);
    
    // Debug logging
    console.log(`[SteelAPI] Scraping ${url} with format=${format.join(',')}, maxLength=${maxLength}, effectiveMaxLength=${effectiveMaxLength}, contentLength=${contentLength}`);

    try {
      // Prepare the request payload according to official API
      const payload: any = {
        url,
        format,
      };

      // Add optional parameters
      if (screenshot) payload.screenshot = screenshot;
      if (pdf) payload.pdf = pdf;
      if (proxyUrl) payload.proxyUrl = proxyUrl;
      if (delay) payload.delay = delay;
      if (logUrl) payload.logUrl = logUrl;

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

      // Extract content based on requested format
      let scrapedData: string = "";
      const primaryFormat = format[0] || "html";
      
      if (responseData.content) {
        if (primaryFormat === "markdown" && responseData.content.markdown) {
          scrapedData = responseData.content.markdown;
        } else if (primaryFormat === "html" && responseData.content.html) {
          scrapedData = responseData.content.html;
        } else if (primaryFormat === "readability" && responseData.content.readability) {
          scrapedData = responseData.content.readability;
        } else if (primaryFormat === "cleaned_html" && responseData.content.cleaned_html) {
          scrapedData = responseData.content.cleaned_html;
        } else {
          // Fallback to first available content
          const availableFormats = Object.keys(responseData.content);
          if (availableFormats.length > 0) {
            scrapedData = responseData.content[availableFormats[0]] as string || "";
          }
        }
      }

      const originalLength = scrapedData.length;
      
      // Debug logging
      console.log(`[SteelAPI] Received ${originalLength} characters from steel-dev API, requested ${contentLength}`);
      
      // Check for markdown conversion issues and collect warnings
      const warnings: string[] = [];
      if (primaryFormat === "markdown") {
        // Detect if we got HTML instead of markdown (common conversion failure)
        const hasHtmlTags = scrapedData.includes('<html') || scrapedData.includes('<!DOCTYPE') || scrapedData.includes('<head>') || 
                           scrapedData.includes('<div') || scrapedData.includes('<span') || scrapedData.includes('<script');
        const hasMarkdownSyntax = scrapedData.includes('# ') || scrapedData.includes('## ') || scrapedData.includes('* ') || 
                                 scrapedData.includes('- ') || scrapedData.includes('[') && scrapedData.includes('](');
        
        if (hasHtmlTags && !hasMarkdownSyntax) {
          const warning = `Markdown conversion failed - received HTML content instead of markdown. The steel-dev API may not support markdown conversion for this page type. Try using format=['readability'] for a simpler text extraction.`;
          warnings.push(warning);
          console.warn(`${warning} for ${url}`);
          console.warn(`[SteelAPI] HTML detected: ${hasHtmlTags}, Markdown detected: ${hasMarkdownSyntax}`);
        }
        
        // Check for truncated markdown that might be incomplete
        if (scrapedData.length > 0 && !scrapedData.trim().endsWith('.') && !scrapedData.trim().endsWith('!') && !scrapedData.trim().endsWith('?') && !scrapedData.trim().endsWith(']')) {
          // This is a heuristic - if content doesn't end with typical sentence endings or markdown elements,
          // it might be truncated mid-sentence
          if (scrapedData.length >= contentLength * 0.95) {
            const warning = `Markdown content may be truncated mid-sentence`;
            warnings.push(warning);
            console.warn(`${warning} for ${url}`);
          }
        }
        
        // Check for very short markdown content that might indicate conversion issues
        if (scrapedData.length < 100 && originalLength > 1000) {
          const warning = `Markdown content is unusually short compared to original content - conversion may have failed`;
          warnings.push(warning);
          console.warn(`${warning} for ${url}`);
        }
      }
      
      // Apply final truncation if content exceeds the effective max length
      let finalData = scrapedData;
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
          timestamp: responseData.metadata?.timestamp || new Date().toISOString(),
          format,
          processingTime: responseData.processingTime,
          contentLength: originalLength,
          returnedLength: finalData.length,
          contentType: response.headers.get('content-type') || 'unknown',
          method: 'full-browser-automation',
          truncated: originalLength > effectiveMaxLength,
          warnings: warnings.length > 0 ? warnings : undefined,
          verboseMode,
          // Official API metadata
          title: responseData.metadata?.title,
          description: responseData.metadata?.description,
          language: responseData.metadata?.language,
          ogImage: responseData.metadata?.ogImage,
          ogTitle: responseData.metadata?.ogTitle,
          ogDescription: responseData.metadata?.ogDescription,
          publishedTimestamp: responseData.metadata?.published_timestamp,
        },
        // Official API response fields
        screenshot: responseData.screenshot,
        pdf: responseData.pdf,
        links: responseData.links,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          format,
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
