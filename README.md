# MCP Server Steel Scraper

A simple Model Context Protocol (MCP) server that wraps the steel-dev API for web scraping with browser automation.

## Features

- **Single Tool**: `scrape_with_browser` - Scrape websites using steel-dev API
- **Flexible Return Types**: HTML, text, markdown, or JSON
- **Local/Remote Support**: Works with local or remote steel-dev instances
- **Browser Automation**: Wait for elements, custom headers, user agents
- **Context Overflow Prevention**: Configurable `maxLength` parameter to limit content size
- **TypeScript**: Fully typed implementation

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd mcp-server-steel-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

The server uses environment variables for configuration:

- `STEEL_API_URL`: The steel-dev API endpoint (default: `http://localhost:3000`)
- `STEEL_TIMEOUT`: Request timeout in milliseconds (default: `30000`)
- `STEEL_RETRIES`: Number of retry attempts (default: `3`)

Copy `env.example` to `.env` and modify as needed:

```bash
cp env.example .env
```

## Usage

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### MCP Client Configuration

Add this server to your MCP client configuration. Here are examples for popular LLM clients:

#### For Claude Desktop / Cline / Other MCP Clients

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "node",
      "args": ["/path/to/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Continue.dev

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "node",
      "args": ["/path/to/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Cursor IDE

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "node",
      "args": ["/path/to/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Local Development (using absolute path)

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "node",
      "args": ["/home/josh/Projects/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Remote Steel-dev Instance

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "node",
      "args": ["/path/to/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "https://your-steel-dev-instance.com"
      }
    }
  }
}
```

### Tool Usage

The server provides one tool: `scrape_with_browser`

#### Parameters

- `url` (required): The URL to scrape
- `returnType` (optional): Return format - `"html"`, `"text"`, `"markdown"`, or `"json"` (default: `"text"`)
- `waitFor` (optional): CSS selector to wait for before scraping
- `timeout` (optional): Timeout in milliseconds (default: `30000`)
- `headers` (optional): Custom headers to send with the request
- `userAgent` (optional): Custom user agent string
- `maxLength` (optional): Maximum characters to return (default: no limit). Use to prevent context overflow in large pages

#### Example Usage

```javascript
// Basic scraping
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://example.com"
  }
}

// Advanced scraping with options
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://example.com",
    "returnType": "markdown",
    "waitFor": ".content",
    "timeout": 60000,
    "userAgent": "Mozilla/5.0 (Custom Bot)"
  }
}

// Scraping with content length limit (prevents context overflow)
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://en.wikipedia.org/wiki/Long_Article",
    "returnType": "text",
    "maxLength": 2000
  }
}
```

## Steel-dev API Requirements

This MCP server expects a steel-dev API instance running with the following endpoints:

- `POST /scrape` - Main scraping endpoint
- `GET /health` - Health check endpoint (optional)
- `GET /info` - API information endpoint (optional)

### Expected Request Format

```json
{
  "url": "https://example.com",
  "returnType": "html",
  "waitFor": ".content",
  "timeout": 30000,
  "headers": {
    "Custom-Header": "value"
  },
  "userAgent": "Mozilla/5.0..."
}
```

### Expected Response Format

```json
{
  "data": "<html>...</html>",
  "processingTime": 1500
}
```

## Development

### Project Structure

```
src/
├── index.ts          # Main MCP server implementation
├── steel-api.ts      # Steel-dev API wrapper
└── config.ts         # Configuration management
```

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Run the built server
- `npm run dev` - Run in development mode with tsx

### Adding New Features

1. Modify the tool schema in `src/index.ts`
2. Update the `SteelAPI` class in `src/steel-api.ts` if needed
3. Rebuild and test

## Error Handling

The server includes comprehensive error handling:

- Network errors are caught and returned as error responses
- Invalid parameters are validated
- Steel-dev API errors are properly forwarded
- Timeout handling for long-running requests

## License

MIT
