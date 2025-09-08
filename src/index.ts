#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SteelAPI, ISteelScraperService, SteelDevScraperService } from "./steel-api.js";
import { SteelErrorCode } from "./errors.js";

// Configuration
const STEEL_API_URL = process.env.STEEL_API_URL || "http://localhost:3000";

class SteelScraperServer {
  private server: Server;
  private steelScraperService: ISteelScraperService;

  constructor() {
    this.server = new Server(
      {
        name: "steel-scraper",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.steelScraperService = new SteelDevScraperService(STEEL_API_URL);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "visit_with_browser",
            description: "Visit any website using full browser automation (stealth mode, anti-detection). Returns page content in your chosen format: 'html' for raw HTML source, 'markdown' for clean formatted text (recommended for reading), 'readability' for Mozilla Readability format, or 'cleaned_html' for cleaned HTML. Supports screenshot and PDF generation. Automatically handles JavaScript rendering and provides clean output by default.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The complete URL to scrape (must include http:// or https://)",
                },
                format: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["html", "readability", "cleaned_html", "markdown"],
                  },
                  description: "Content formats to extract: 'html'=raw HTML source (may be very large), 'markdown'=clean formatted text converted from HTML (recommended for reading), 'readability'=Mozilla Readability format, 'cleaned_html'=cleaned HTML. You can request multiple formats.",
                  default: ["markdown"],
                },
                screenshot: {
                  type: "boolean",
                  description: "Take a screenshot of the page (returns base64 encoded image)",
                  default: false,
                },
                pdf: {
                  type: "boolean",
                  description: "Generate a PDF of the page (returns base64 encoded PDF)",
                  default: false,
                },
                proxyUrl: {
                  type: "string",
                  description: "Proxy URL to use for the request (e.g., 'http://proxy:port')",
                },
                delay: {
                  type: "number",
                  description: "Delay in seconds to wait after page load before scraping",
                  default: 0,
                },
                logUrl: {
                  type: "string",
                  description: "URL to send logs to for debugging purposes",
                },
                maxLength: {
                  type: "number",
                  description: "Maximum characters to return (optional). Smart defaults: markdown=8000, readability=10000, html=15000, cleaned_html=12000. For markdown, automatically reserves space for metadata.",
                  default: null,
                },
                verboseMode: {
                  type: "boolean",
                  description: "Return full metadata instead of clean content-focused output (optional, default: false). Use when you need detailed scraping information.",
                  default: false,
                },
              },
              required: ["url"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "visit_with_browser") {
        try {
          const { url, format = ["markdown"], screenshot = false, pdf = false, proxyUrl, delay = 0, logUrl, maxLength, verboseMode = false } = request.params.arguments as {
            url: string;
            format?: ("html" | "readability" | "cleaned_html" | "markdown")[];
            screenshot?: boolean;
            pdf?: boolean;
            proxyUrl?: string;
            delay?: number;
            logUrl?: string;
            maxLength?: number;
            verboseMode?: boolean;
          };

          const result = await this.steelScraperService.scrapeWithBrowser({
            url,
            format,
            screenshot,
            pdf,
            proxyUrl,
            delay,
            logUrl,
            maxLength,
            verboseMode,
          });

          // Create a more model-friendly response structure
          if (result.success) {
            // Default: clean mode (minimal metadata, focus on content)
            if (!verboseMode) {
              const cleanText = result.metadata?.warnings && result.metadata.warnings.length > 0 
                ? `[WARNING: ${result.metadata.warnings.join('; ')}]\n\n${result.data}`
                : result.data;
              
              return {
                content: [
                  {
                    type: "text",
                    text: cleanText,
                  },
                ],
              };
            }
            
            // Verbose mode: full metadata
            return {
              content: [
                {
                  type: "text",
                  text: `SUCCESS: Successfully scraped ${result.metadata?.url}
Method: ${result.metadata?.method} (stealth browser, anti-detection)
Format: ${result.metadata?.format?.join(', ')}
Status Code: ${result.statusCode}
Processing Time: ${result.metadata?.processingTime}ms
Content Length: ${result.metadata?.contentLength} characters${result.metadata?.truncated ? ` (truncated to ${result.metadata?.returnedLength} characters)` : ''}${result.metadata?.warnings && result.metadata.warnings.length > 0 ? `\nWarnings: ${result.metadata.warnings.join('; ')}` : ''}
Content Type: ${result.metadata?.contentType}
Timestamp: ${result.metadata?.timestamp}${result.metadata?.title ? `\nTitle: ${result.metadata.title}` : ''}${result.metadata?.description ? `\nDescription: ${result.metadata.description}` : ''}${result.metadata?.language ? `\nLanguage: ${result.metadata.language}` : ''}${result.screenshot ? '\nScreenshot: Available (base64)' : ''}${result.pdf ? '\nPDF: Available (base64)' : ''}${result.links && result.links.length > 0 ? `\nLinks Found: ${result.links.length}` : ''}

SCRAPED CONTENT:
${result.data}`,
                },
              ],
            };
          } else {
            // Default: clean mode (minimal error info)
            if (!verboseMode) {
              // For clean mode, provide minimal error information
              let errorText = `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}`;
              
              // Include error code if available
              if (result.errorCode) {
                errorText += ` (${result.errorCode})`;
              }
              
              // Include basic error message
              if (result.error) {
                errorText += `: ${result.error}`;
              }
              
              return {
                content: [
                  {
                    type: "text",
                    text: errorText,
                  },
                ],
                isError: true,
              };
            }
            
            // Verbose mode: full error info including error code and metadata
            let errorText = `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}\n`;
            
            // Include error code if available
            if (result.errorCode) {
              errorText += `Error Code: ${result.errorCode}\n`;
            }
            
            // Include error message
            if (result.error) {
              errorText += `Error: ${result.error}\n`;
            }
            
            // Include status code
            errorText += `Status Code: ${result.statusCode || 'unknown'}\n`;
            
            // Include timestamp
            errorText += `Timestamp: ${result.metadata?.timestamp || new Date().toISOString()}\n`;
            
            // Include error metadata if available
            if (result.errorMetadata) {
              errorText += `Error Metadata: ${JSON.stringify(result.errorMetadata, null, 2)}\n`;
            }
            
            return {
              content: [
                {
                  type: "text",
                  text: errorText,
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          // Handle unexpected errors
          const errorText = error instanceof Error ? error.message : String(error);
          const errorCode = error instanceof Error && error.name === 'SteelDevError' ?
            (error as any).code : SteelErrorCode.UNKNOWN_ERROR;
          
          return {
            content: [
              {
                type: "text",
                text: `Unexpected Error: ${errorText} (${errorCode})`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Steel Scraper MCP server running on stdio");
  }
}

// Start the server
const server = new SteelScraperServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
