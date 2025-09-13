import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SteelAPI, ISteelScraperService, SteelDevScraperService } from "./steel-api.js";
import { loadConfig } from "./config.js";
import { formatSuccessResponse, formatErrorResponse } from "./response-formatter";
import { SteelErrorCode } from "./errors.js";
import { setupHandlers } from "./handlers";

class SteelScraperServer {
  private server: Server;
  private steelScraperService: ISteelScraperService;

  constructor() {
    this.server = new Server(
      { name: "steel-scraper", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    this.steelScraperService = new SteelDevScraperService(loadConfig().steelApiUrl);
    setupHandlers(this.server, this.steelScraperService);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Steel Scraper MCP server running on stdio");
  }
}

export { SteelScraperServer };
