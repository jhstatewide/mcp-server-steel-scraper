import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SteelAPI, ISteelScraperService, SteelDevScraperService } from "./steel-api.js";
import { loadConfig } from "./config.js";
import { formatSuccessResponse, formatErrorResponse } from "./response-formatter";

class SteelScraperServer {
  private server: Server;
  private steelScraperService: ISteelScraperService;

  constructor() {
    this.server = new Server(
      { name: "steel-scraper", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.steelScraperService = new SteelDevScraperService(loadConfig().steelApiUrl);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [{
        name: "visit_with_browser",
        description: "Visit any website using full browser automation (stealth mode, anti-detection). Returns page content in your chosen format: 'html' for raw HTML source, 'markdown' for clean formatted text (recommended for reading), 'readability' for Mozilla Readability format, or 'cleaned_html' for cleaned HTML. Supports screenshot and PDF generation. Automatically handles JavaScript rendering and provides clean output by default.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The complete URL to scrape (must include http:// or https://)" },
            format: { 
              type: "array",
              items: { type: "string", enum: ["html", "readability", "cleaned_html", "markdown"] },
              description: "Content formats to extract: 'html'=raw HTML source (may be very large), 'markdown'=clean formatted text converted from HTML (recommended for reading), 'readability'=Mozilla Readability format, 'cleaned_html'=cleaned HTML. You can request multiple formats.",
              default: ["markdown"]
            },
            screenshot: { type: "boolean", description: "Take a screenshot of the page (returns base64 encoded image)", default: false },
            pdf: { type: "boolean", description: "Generate a PDF of the page (returns base64 encoded PDF)", default: false },
            proxyUrl: { type: "string", description: "Proxy URL to use for the request (e.g., 'http://proxy:port')" },
            delay: { type: "number", description: "Delay in seconds to wait after page load before scraping", default: 0 },
            logUrl: { type: "string", description: "URL to send logs to for debugging purposes" },
            maxLength: { 
              type: "number",
              description: "Maximum characters to return (optional). Smart defaults: markdown=8000, readability=10000, html=15000, cleaned_html=12000. For markdown, automatically reserves space for metadata.",
              default: null
            },
            verboseMode: { 
              type: "boolean",
              description: "Return full metadata instead of clean content-focused output (optional, default: false). Use when you need detailed scraping information.",
              default: false
            }
          },
          required: ["url"]
        }
      }]
    }));

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

          return result.success 
            ? formatSuccessResponse(result, verboseMode) 
            : formatErrorResponse(result, verboseMode);
        } catch (error) {
          const errorText = error instanceof Error ? error.message : String(error);
          const errorCode = error instanceof Error && error.name === 'SteelDevError' 
            ? (error as any).code 
            : SteelErrorCode.UNKNOWN_ERROR;
          
          return { 
            content: [{ type: "text", text: `Unexpected Error: ${errorText} (${errorCode})` }],
            isError: true 
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

export { SteelScraperServer };
