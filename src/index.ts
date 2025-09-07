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
            description: "Scrape a website using steel-dev API with browser automation",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to scrape",
                },
                returnType: {
                  type: "string",
                  enum: ["html", "text", "markdown", "json"],
                  description: "The format to return the scraped content",
                  default: "html",
                },
                waitFor: {
                  type: "string",
                  description: "CSS selector to wait for before scraping (optional)",
                },
                timeout: {
                  type: "number",
                  description: "Timeout in milliseconds (optional, default: 30000)",
                  default: 30000,
                },
                headers: {
                  type: "object",
                  description: "Custom headers to send with the request (optional)",
                },
                userAgent: {
                  type: "string",
                  description: "Custom user agent string (optional)",
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
          const { url, returnType = "html", waitFor, timeout = 30000, headers, userAgent } = request.params.arguments as {
            url: string;
            returnType?: "html" | "text" | "markdown" | "json";
            waitFor?: string;
            timeout?: number;
            headers?: Record<string, string>;
            userAgent?: string;
          };

          const result = await this.steelAPI.scrapeWithBrowser({
            url,
            returnType,
            waitFor,
            timeout,
            headers,
            userAgent,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
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
