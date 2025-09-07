#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SteelAPI } from "./steel-api.js";

// Configuration
const STEEL_API_URL = process.env.STEEL_API_URL || "http://localhost:3000";

class SteelScraperServer {
  private server: Server;
  private steelAPI: SteelAPI;

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

    this.steelAPI = new SteelAPI(STEEL_API_URL);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "scrape_with_browser",
            description: "Scrape any website using full browser automation (stealth mode, anti-detection). Returns the full page content in your chosen format. Use 'text' for clean text, 'html' for raw HTML, 'markdown' for formatted markdown, or 'json' for structured data.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The complete URL to scrape (must include http:// or https://)",
                },
                returnType: {
                  type: "string",
                  enum: ["html", "text", "markdown", "json"],
                  description: "Content format: 'text'=clean text, 'html'=raw HTML, 'markdown'=formatted, 'json'=structured data",
                  default: "text",
                },
                waitFor: {
                  type: "string",
                  description: "Optional CSS selector to wait for before scraping (e.g., '.content', '#main')",
                },
                timeout: {
                  type: "number",
                  description: "Maximum wait time in milliseconds (default: 30000 = 30 seconds)",
                  default: 30000,
                },
                headers: {
                  type: "object",
                  description: "Optional custom HTTP headers as key-value pairs",
                },
                userAgent: {
                  type: "string",
                  description: "Optional custom user agent string",
                },
                maxLength: {
                  type: "number",
                  description: "Maximum characters to return (optional). Smart defaults: markdown=8000, text=10000, html=15000, json=5000. For markdown, automatically reserves space for metadata.",
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
      if (request.params.name === "scrape_with_browser") {
        try {
          const { url, returnType = "html", waitFor, timeout = 30000, headers, userAgent, maxLength, verboseMode } = request.params.arguments as {
            url: string;
            returnType?: "html" | "text" | "markdown" | "json";
            waitFor?: string;
            timeout?: number;
            headers?: Record<string, string>;
            userAgent?: string;
            maxLength?: number;
            verboseMode?: boolean;
          };

          const result = await this.steelAPI.scrapeWithBrowser({
            url,
            returnType,
            waitFor,
            timeout,
            headers,
            userAgent,
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
Return Type: ${result.metadata?.returnType}
Status Code: ${result.statusCode}
Processing Time: ${result.metadata?.processingTime}ms
Content Length: ${result.metadata?.contentLength} characters${result.metadata?.truncated ? ` (truncated to ${result.metadata?.returnedLength} characters)` : ''}${result.metadata?.warnings && result.metadata.warnings.length > 0 ? `\nWarnings: ${result.metadata.warnings.join('; ')}` : ''}
Content Type: ${result.metadata?.contentType}
Timestamp: ${result.metadata?.timestamp}

SCRAPED CONTENT:
${result.data}`,
                },
              ],
            };
          } else {
            // Default: clean mode (minimal error info)
            if (!verboseMode) {
              return {
                content: [
                  {
                    type: "text",
                    text: `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}: ${result.error}`,
                  },
                ],
                isError: true,
              };
            }
            
            // Verbose mode: full error info
            return {
              content: [
                {
                  type: "text",
                  text: `ERROR: Failed to scrape ${result.metadata?.url || 'unknown URL'}
Error: ${result.error}
Status Code: ${result.statusCode || 'unknown'}
Timestamp: ${result.metadata?.timestamp || new Date().toISOString()}`,
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
