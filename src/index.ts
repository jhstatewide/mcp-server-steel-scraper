#!/usr/bin/env node

import { SteelScraperServer } from "./steel-scraper-server";

const server = new SteelScraperServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
