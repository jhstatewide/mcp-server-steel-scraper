# MCP Server Steel Scraper

A simple Model Context Protocol (MCP) server that wraps the steel-dev API for web scraping with browser automation.

## Features

- **Single Tool**: `scrape_with_browser` - Scrape websites using steel-dev API
- **Flexible Return Types**: HTML, text, markdown, or JSON
- **Local/Remote Support**: Works with local or remote steel-dev instances
- **Browser Automation**: Wait for elements, custom headers, user agents
- **Smart Length Management**: Single `maxLength` parameter with intelligent defaults and automatic content/metadata split
- **Clean Output by Default**: Minimal metadata output perfect for 7B models and summarization
- **Verbose Mode**: Optional full metadata when detailed information is needed
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
- `maxLength` (optional): Maximum characters to return. Smart defaults: markdown=8000, text=10000, html=15000, json=5000. For markdown, automatically reserves space for metadata
- `verboseMode` (optional): Return full metadata instead of clean content-focused output (default: false). Use when you need detailed scraping information

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

// Simple scraping with smart defaults (perfect for 7B models)
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://example.com",
    "returnType": "markdown"
  }
}

// Custom length limit (automatically handles content vs metadata split)
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://en.wikipedia.org/wiki/Long_Article",
    "returnType": "markdown",
    "maxLength": 5000
  }
}

// Verbose mode when you need detailed scraping information
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://example.com",
    "returnType": "markdown",
    "maxLength": 8000,
    "verboseMode": true
  }
}
```

## Smart Length Management

The server automatically handles content length optimization:

- **Unified Length Control**: Single `maxLength` parameter handles both content and metadata
- **Automatic Content/Metadata Split**: For markdown, reserves 10% for metadata, uses 90% for content
- **Smart Defaults**: Reasonable defaults when no length is specified (markdown=8000, text=10000, html=15000, json=5000)
- **Better Truncation**: Avoids double-truncation issues that could result in incomplete content
- **Conversion Detection**: Automatically detects when HTML-to-markdown conversion may have failed
- **Warning System**: Provides warnings when content appears truncated or incomplete

### How It Works

```javascript
// Simple usage - uses smart defaults
{
  "url": "https://example.com",
  "returnType": "markdown"
  // Automatically uses 8000 characters, reserves 800 for metadata, 7200 for content
}

// Custom length - automatically splits appropriately
{
  "url": "https://example.com", 
  "returnType": "markdown",
  "maxLength": 5000
  // Uses 5000 total, reserves 500 for metadata, 4500 for content
}
```

This approach ensures you get complete, properly formatted content while maintaining simple, intuitive parameter management.

## Clean Output by Default

The server is designed with 7B models in mind, providing clean, content-focused output by default:

- **Content Summarization**: Perfect for weaker models that need to summarize web content
- **Content Analysis**: Ideal for processing large amounts of text
- **Context Optimization**: Maximizes the content-to-metadata ratio automatically

### How It Works

**Default Mode** (clean output):
```
# Article Title
This is the actual content...
```

**Verbose Mode** (`verboseMode: true`):
```
SUCCESS: Successfully scraped https://example.com
Method: full-browser-automation (stealth browser, anti-detection)
Return Type: markdown
Status Code: 200
Processing Time: 1250ms
Content Length: 5000 characters
Content Type: text/html
Timestamp: 2024-01-15T10:30:00.000Z

SCRAPED CONTENT:
# Article Title
This is the actual content...
```

### Benefits of Clean Output

- **Maximum Content Space**: Removes ~200-300 characters of metadata overhead
- **Cleaner Output**: Direct content without verbose headers
- **Better for 7B Models**: Focuses the model's attention on the actual content
- **Preserves Warnings**: Still shows important warnings if conversion issues occur

### Recommended Usage

For summarization tasks, use the default clean output:

```javascript
{
  "tool": "scrape_with_browser",
  "arguments": {
    "url": "https://article-to-summarize.com",
    "returnType": "markdown",
    "maxLength": 10000  // Automatically optimizes content vs metadata split
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
