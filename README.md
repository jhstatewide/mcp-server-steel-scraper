# MCP Server Steel Scraper

A simple Model Context Protocol (MCP) server that wraps the steel-dev API for visiting websites with browser automation.

## Quick Start

1. **Install the package:**
   ```bash
   npm install -g @jharding_npm/mcp-server-steel-scraper
   ```

2. **Add to your MCP client configuration:**
   ```json
   {
     "mcpServers": {
       "steel-scraper": {
         "command": "npx",
        "args": ["@jharding_npm/mcp-server-steel-scraper", "--mode=both"],
        "env": {
          "STEEL_API_URL": "http://localhost:3000"
        }
      }
    }
  }
   ```

3. **Start using the stateless `visit_with_browser` tool, or the stateful interactive tools.**

## Features

- **Dual Modes**: Run stateless scraping, stateful interaction, or both via `--mode=stateless|stateful|both` (default: `both`)
- **Stateless Tool**: `visit_with_browser` - Visit websites using steel-dev API
- **Stateful Tools**: Create sessions and interact with pages (navigate, click, type, scroll, snapshot)
- **Flexible Return Types**: HTML, markdown, readability, or cleaned HTML
- **Local/Remote Support**: Works with local or remote steel-dev instances
- **Browser Automation**: Screenshot capture, PDF generation, proxy support
- **Smart Length Management**: Single `maxLength` parameter with intelligent defaults and automatic content/metadata split
- **Clean Output by Default**: Minimal metadata output perfect for 7B models and summarization
- **Verbose Mode**: Optional full metadata when detailed information is needed
- **TypeScript**: Fully typed implementation

## Installation

### Option 1: NPM Package (Recommended)

Install the package globally to use it with npx:

```bash
npm install -g @jharding_npm/mcp-server-steel-scraper
```

Or use it directly with npx without installing:

```bash
npx @jharding_npm/mcp-server-steel-scraper
```

### Option 2: Local Development

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
- `STEEL_LOCAL`: Set to `true` when using a local Steel instance for stateful sessions
- `STEEL_BASE_URL`: Base URL for the Steel Sessions API (default: `https://api.steel.dev`, or `http://localhost:3000` when `STEEL_LOCAL=true`)
- `STEEL_API_KEY`: Required for cloud mode stateful sessions
- `STEEL_SESSION_TIMEOUT_MS`: Session timeout in milliseconds (default: `900000`)
- `STEEL_GLOBAL_WAIT_SECONDS`: Optional delay after each stateful action (default: `0`)
- `STEEL_IDLE_TIMEOUT_MS`: Auto-release idle sessions after this many milliseconds (default: `600000`, set to `0` to disable)

Copy `env.example` to `.env` and modify as needed:

```bash
cp env.example .env
```

## Usage

### Running the Server

```bash
# Development mode
npm run dev

# Auto-rebuild on changes (recommended for npm link workflows)
npm run build:watch

# Production mode
npm start

# Only stateless scraping tools
npm start -- --mode=stateless

# Only stateful interactive tools
npm start -- --mode=stateful

# Both tool sets (default)
npm start -- --mode=both
```

### MCP Client Configuration

Add this server to your MCP client configuration. Here are examples for popular LLM clients:

#### For Claude Desktop / Cline / Other MCP Clients (NPM Package)

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "npx",
      "args": ["@jharding_npm/mcp-server-steel-scraper", "--mode=stateless"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

To expose the stateful interactive tools, add `--mode=stateful` or `--mode=both` to the `args` array.

#### For Continue.dev (NPM Package)

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "npx",
      "args": ["@jharding_npm/mcp-server-steel-scraper", "--mode=stateless"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Cursor IDE (NPM Package)

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "npx",
      "args": ["@jharding_npm/mcp-server-steel-scraper", "--mode=stateless"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

#### For Remote Steel-dev Instance (NPM Package)

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "npx",
      "args": ["@jharding_npm/mcp-server-steel-scraper", "--mode=stateless"],
      "env": {
        "STEEL_API_URL": "https://your-steel-dev-instance.com"
      }
    }
  }
}
```

#### Alternative: Using Global Installation

If you've installed the package globally with `npm install -g @jharding_npm/mcp-server-steel-scraper`, you can use:

```json
{
  "mcpServers": {
    "steel-scraper": {
      "command": "mcp-server-steel-scraper",
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
      "args": ["/path/to/mcp-server-steel-scraper/dist/index.js"],
      "env": {
        "STEEL_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Tool Usage

The server provides one tool: `visit_with_browser`

#### Parameters

- `url` (required): The URL to visit
- `format` (optional): Content formats to extract - `["html"]` for raw HTML source (may be very large), `["markdown"]` for clean formatted text converted from HTML (recommended for reading), `["readability"]` for Mozilla Readability format, `["cleaned_html"]` for cleaned HTML. You can request multiple formats (default: `["markdown"]`)
- `screenshot` (optional): Take a screenshot of the page (returns base64 encoded image) (default: `false`)
- `pdf` (optional): Generate a PDF of the page (returns base64 encoded PDF) (default: `false`)
- `proxyUrl` (optional): Proxy URL to use for the request (e.g., `"http://proxy:port"`)
- `delay` (optional): Delay in seconds to wait after page load before scraping (default: `0`)
- `logUrl` (optional): URL to send logs to for debugging purposes
- `maxLength` (optional): Maximum characters to return. Smart defaults: markdown=8000, readability=10000, html=15000, cleaned_html=12000. For markdown, automatically reserves space for metadata
- `verboseMode` (optional): Return full metadata instead of clean content-focused output (default: false). Use when you need detailed visit information

#### Example Usage

```javascript
// Basic website visit
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://example.com"
  }
}

// Advanced visit with multiple formats
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://example.com",
    "format": ["markdown", "html"],
    "screenshot": true,
    "delay": 2
  }
}

// Simple visit with smart defaults (perfect for 7B models)
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://example.com",
    "format": ["markdown"]
  }
}

// Custom length limit (automatically handles content vs metadata split)
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://en.wikipedia.org/wiki/Long_Article",
    "format": ["markdown"],
    "maxLength": 5000
  }
}

// Verbose mode when you need detailed visit information
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://example.com",
    "format": ["markdown"],
    "maxLength": 8000,
    "verboseMode": true
  }
}

// With proxy and PDF generation
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://example.com",
    "format": ["readability"],
    "pdf": true,
    "proxyUrl": "http://proxy:8080"
  }
}
```

### Stateful Interactive Tools

When running with `--mode=stateful` or `--mode=both`, the server exposes stateful tools that let the LLM interact with a live page.
Stateful sessions are created via the Steel Sessions API and connected over CDP (Chrome DevTools Protocol).

#### Available Tools

- `session_create` - Create a new Steel session and connect
- `session_release` - Release the current session
- `navigate` - Navigate to a URL
- `search` - Open Google search results for a query
- `click` - Click an element by label
- `type` - Type into an element by label
- `scroll_down` / `scroll_up` - Scroll the page
- `go_back` - Navigate back
- `wait` - Wait a few seconds for dynamic content
- `snapshot` - Annotated screenshot + labels list
- `snapshot_unmarked` - Screenshot without labels
- `page_content` - Return page HTML or text

#### Example Session

```javascript
// Create a session
{
  "tool": "session_create",
  "arguments": { "timeoutMs": 900000 }
}

// Navigate
{
  "tool": "navigate",
  "arguments": { "url": "https://example.com" }
}

// Get an annotated snapshot (labels + image)
{
  "tool": "snapshot",
  "arguments": {}
}

// Click a labeled element
{
  "tool": "click",
  "arguments": { "label": 3 }
}

// Type into a labeled input
{
  "tool": "type",
  "arguments": { "label": 5, "text": "hello", "replaceText": true }
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
  "format": ["markdown"]
  // Automatically uses 8000 characters, reserves 800 for metadata, 7200 for content
}

// Custom length - automatically splits appropriately
{
  "url": "https://example.com", 
  "format": ["markdown"],
  "maxLength": 5000
  // Uses 5000 total, reserves 500 for metadata, 4500 for content
}
```

This approach ensures you get complete, properly formatted content while maintaining simple, intuitive parameter management.

## Handling Large Pages (Like Amazon)

For large, complex pages like Amazon.com, follow these best practices:

### Recommended Approach for Complex Pages
```javascript
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://www.amazon.com",
    "format": ["readability"],  // Most reliable for complex pages
    "maxLength": 5000,          // Reasonable limit for large pages
    "delay": 3                  // Wait for main content to load
  }
}
```

### Format Comparison for Large Pages
- **HTML**: Returns raw HTML source (can be 900,000+ characters for Amazon)
- **Readability**: Mozilla Readability format (most reliable, good for complex pages)
- **Markdown**: Converts HTML to clean, readable text (may fail on complex pages like Amazon)
- **Cleaned HTML**: Cleaned HTML with better structure

**Note**: Markdown conversion may fail on complex, JavaScript-heavy pages like Amazon. Use `["readability"]` for the most reliable results.

### Troubleshooting

**If you get HTML instead of Markdown:**
- The steel-dev API may not support markdown conversion for that page type
- Try using `format: ["readability"]` instead for better text extraction
- Complex pages with heavy JavaScript may not convert properly

**If you get truncated content:**
- The page may be too large for the specified `maxLength`
- Try increasing `maxLength` or using a longer `delay`
- Consider using `format: ["readability"]` for more reliable truncation

### For Dynamic Content
Use `delay` parameter to wait for content to load:
```javascript
{
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://www.amazon.com",
    "format": ["markdown"],
    "delay": 5,                 // Wait 5 seconds for content to load
    "maxLength": 10000          // Longer content for complex pages
  }
}
```

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
Format: markdown
Status Code: 200
Processing Time: 1250ms
Content Length: 5000 characters
Content Type: text/html
Timestamp: 2024-01-15T10:30:00.000Z
Title: Article Title
Description: Article description
Language: en
Screenshot: Available (base64)
Links Found: 15

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
  "tool": "visit_with_browser",
  "arguments": {
    "url": "https://article-to-summarize.com",
    "format": ["markdown"],
    "maxLength": 10000  // Automatically optimizes content vs metadata split
  }
}
```

## Steel-dev API Requirements

This MCP server expects a steel-dev API instance running with the following endpoints:

- `POST /scrape` - Main scraping endpoint
- `GET /health` - Health check endpoint (optional)
- `GET /info` - API information endpoint (optional)
- `POST /v1/sessions` - Create a stateful browser session
- `POST /v1/sessions/{id}/release` - Release a stateful session

### Expected Request Format

```json
{
  "url": "https://example.com",
  "format": ["html", "markdown"],
  "screenshot": true,
  "pdf": false,
  "proxyUrl": "http://proxy:8080",
  "delay": 2,
  "logUrl": "https://logs.example.com"
}
```

### Expected Response Format

```json
{
  "content": {
    "html": "<html>...</html>",
    "markdown": "# Title\nContent..."
  },
  "metadata": {
    "title": "Page Title",
    "description": "Page description",
    "statusCode": 200,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "links": [
    {"url": "https://example.com/link1", "text": "Link Text"}
  ],
  "screenshot": "base64...",
  "pdf": "base64..."
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
