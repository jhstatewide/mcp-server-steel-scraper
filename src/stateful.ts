import { chromium, Browser, Page } from "playwright-core";
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

type Mode = "stateless" | "stateful" | "both";

type SessionCreateOptions = {
  timeoutMs?: number;
  useProxy?: boolean;
  solveCaptcha?: boolean;
  userAgent?: string;
};

type SessionInfo = {
  id: string;
  websocketUrl?: string;
  status?: "live" | "released" | "failed";
};

type LabeledElement = {
  x: number;
  y: number;
  type: string;
  text: string;
  ariaLabel: string;
};

const MARK_PAGE_SCRIPT = `
if (typeof window.labels === 'undefined') {
  window.labels = [];
}
function unmarkPage() {
  for (const label of window.labels) {
    document.body.removeChild(label);
  }
  window.labels = [];
  const labeledElements = document.querySelectorAll('[data-label]');
  labeledElements.forEach(el => el.removeAttribute('data-label'));
}
function markPage() {
  unmarkPage();
  var items = Array.from(
    document.querySelectorAll("a, button, input, select, textarea, [role='button'], [role='link']")
  )
    .map(function (element) {
      var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      var textualContent = element.textContent?.trim().replace(/\\s{2,}/g, " ") || "";
      var elementType = element.tagName.toLowerCase();
      var ariaLabel = element.getAttribute("aria-label") || "";
      var rect = element.getBoundingClientRect();
      var bbox = {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        right: Math.min(vw, rect.right),
        bottom: Math.min(vh, rect.bottom),
        width: Math.min(vw, rect.right) - Math.max(0, rect.left),
        height: Math.min(vh, rect.bottom) - Math.max(0, rect.top)
      };
      return {
        element,
        include:
          element.tagName === "INPUT" ||
          element.tagName === "TEXTAREA" ||
          element.tagName === "SELECT" ||
          element.tagName === "BUTTON" ||
          element.tagName === "A" ||
          element.onclick != null ||
          window.getComputedStyle(element).cursor == "pointer" ||
          element.tagName === "IFRAME" ||
          element.tagName === "VIDEO",
        bbox,
        rects: [bbox],
        text: textualContent,
        type: elementType,
        ariaLabel
      };
    })
    .filter(item => item.include && item.bbox.width * item.bbox.height >= 20);
  items = items.filter(
    (x) => !items.some((y) => x.element.contains(y.element) && x !== y)
  );
  items.forEach((item, index) => {
    item.element.setAttribute("data-label", index.toString());
    item.rects.forEach((bbox) => {
      const newElement = document.createElement("div");
      const borderColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
      newElement.style.outline = \`2px dashed \${borderColor}\`;
      newElement.style.position = "fixed";
      newElement.style.left = bbox.left + "px";
      newElement.style.top = bbox.top + "px";
      newElement.style.width = bbox.width + "px";
      newElement.style.height = bbox.height + "px";
      newElement.style.pointerEvents = "none";
      newElement.style.boxSizing = "border-box";
      newElement.style.zIndex = "2147483647";
      const label = document.createElement("span");
      label.textContent = index.toString();
      label.style.position = "absolute";
      const hasSpaceAbove = bbox.top >= 20;
      if (hasSpaceAbove) {
        label.style.top = "-19px";
        label.style.left = "0px";
      } else {
        label.style.top = "0px";
        label.style.left = "0px";
      }
      label.style.background = borderColor;
      label.style.color = "white";
      label.style.padding = "2px 4px";
      label.style.fontSize = "12px";
      label.style.borderRadius = "2px";
      label.style.zIndex = "2147483647";
      newElement.appendChild(label);
      document.body.appendChild(newElement);
      window.labels.push(newElement);
    });
  });
  return items.map((item) => ({
    x: item.bbox.left + item.bbox.width / 2,
    y: item.bbox.top + item.bbox.height / 2,
    type: item.type,
    text: item.text,
    ariaLabel: item.ariaLabel
  }));
}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatLabelText(labels: LabeledElement[], limit: number = 200): string {
  const trimmed = labels.slice(0, limit);
  const lines = trimmed.map((label, index) => {
    const text = label.text ? label.text.slice(0, 120) : "";
    const aria = label.ariaLabel ? label.ariaLabel.slice(0, 120) : "";
    const summary = [text && `text="${text}"`, aria && `aria="${aria}"`]
      .filter(Boolean)
      .join(" ");
    return `${index}. ${label.type}${summary ? " " + summary : ""} @(${Math.round(label.x)},${Math.round(label.y)})`;
  });
  const suffix = labels.length > limit ? `\n... (${labels.length - limit} more)` : "";
  return lines.join("\n") + suffix;
}

class SteelSessionManager {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly isLocal: boolean;
  private readonly defaultTimeoutMs: number;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionId: string | null = null;

  constructor(options: {
    baseUrl: string;
    apiKey?: string;
    isLocal: boolean;
    defaultTimeoutMs: number;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.isLocal = options.isLocal;
    this.defaultTimeoutMs = options.defaultTimeoutMs;
  }

  async createSession(options: SessionCreateOptions = {}): Promise<SessionInfo> {
    const payload: Record<string, unknown> = {
      timeout: options.timeoutMs ?? this.defaultTimeoutMs,
    };
    if (options.useProxy !== undefined) payload.useProxy = options.useProxy;
    if (options.solveCaptcha !== undefined) payload.solveCaptcha = options.solveCaptcha;
    if (options.userAgent) payload.userAgent = options.userAgent;

    const response = await fetch(`${this.baseUrl}/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "steel-api-key": this.apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      websocketUrl: data.websocketUrl,
      status: data.status,
    };
  }

  private buildWebSocketUrl(session: SessionInfo): string {
    let url = session.websocketUrl || "";
    
    if (url) {
      if (this.apiKey && !url.includes("apiKey=")) {
        url += (url.includes("?") ? "&" : "?") + `apiKey=${this.apiKey}`;
      }
      if (!url.includes("sessionId=")) {
        url += (url.includes("?") ? "&" : "?") + `sessionId=${session.id}`;
      }
    }
    
    const lower = this.baseUrl.toLowerCase();
    
    if (!url && (lower.startsWith("http://") || lower.startsWith("https://"))) {
      const protocol = lower.startsWith("https://") ? "wss" : "ws";
      const baseUrl = lower.replace(/^https?:\/\//, "");
      const [hostPort] = baseUrl.split("/");
      url = `${protocol}://${hostPort}/?sessionId=${session.id}`;
    }
    
    if (url.includes("ws://0.0.0.0") || url.includes("wss://0.0.0.0")) {
      const lowerUrl = url.toLowerCase();
      const protocolMatch = lowerUrl.match(/^wss?:\/\//);
      if (protocolMatch) {
        const protocol = protocolMatch[0];
        const portMatch = url.match(/:([0-9]+)/);
        const hostPort = this.baseUrl.replace(/^https?:\/\//, "").split("/")[0];
        if (portMatch) {
          url = url.replace(/0\.0\.0\.0/, hostPort) + `?sessionId=${session.id}`;
        } else {
          url = url.replace(/ws:\/\/0\.0\.0\.0/, `ws://${hostPort}`) + `?sessionId=${session.id}`;
        }
      }
    }
    
    if (!url) {
      throw new Error(`Invalid Steel WebSocket URL: ${session.websocketUrl}`);
    }
    
    return url;
  }

  private async connectToSession(session: SessionInfo): Promise<void> {
    const wsEndpoint = this.buildWebSocketUrl(session);
    this.browser = await chromium.connectOverCDP(wsEndpoint);
    const context = this.browser.contexts()[0] ?? (await this.browser.newContext());
    this.page = context.pages()[0] ?? (await context.newPage());
    await this.setupPage();
  }

  private async setupPage(): Promise<void> {
    if (!this.page) return;
    await this.page.addInitScript(MARK_PAGE_SCRIPT);
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async ensureSession(options?: SessionCreateOptions): Promise<Page> {
    if (this.browser && this.browser.isConnected() && this.page && !this.page.isClosed()) {
      return this.page;
    }
    await this.cleanup(false);
    const session = await this.createSession(options);
    this.sessionId = session.id;
    await this.connectToSession(session);
    return this.page!;
  }

  async releaseSession(): Promise<void> {
    await this.cleanup(true);
  }

  private async cleanup(releaseRemote: boolean): Promise<void> {
    if (releaseRemote && !this.isLocal && this.sessionId) {
      try {
        await fetch(`${this.baseUrl}/v1/sessions/${this.sessionId}/release`, {
          method: "POST",
          headers: {
            ...(this.apiKey ? { "steel-api-key": this.apiKey } : {}),
          },
        });
      } catch {
        // Best-effort release
      }
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
    }
    this.browser = null;
    this.page = null;
    this.sessionId = null;
  }

  async annotateAndScreenshot(): Promise<{ labels: LabeledElement[]; imageBase64: string }> {
    if (!this.page) {
      throw new Error("No active page");
    }
    const labels = (await this.page.evaluate(`${MARK_PAGE_SCRIPT}; markPage();`)) as LabeledElement[];
    const buffer = await this.page.screenshot({ type: "png" });
    return { labels, imageBase64: Buffer.from(buffer).toString("base64") };
  }

  async screenshotUnmarked(): Promise<string> {
    if (!this.page) {
      throw new Error("No active page");
    }
    await this.page.evaluate(`${MARK_PAGE_SCRIPT}; unmarkPage();`);
    const buffer = await this.page.screenshot({ type: "png" });
    await this.page.evaluate(`${MARK_PAGE_SCRIPT}; markPage();`);
    return Buffer.from(buffer).toString("base64");
  }
}

export class StatefulBrowserController {
  private readonly sessionManager: SteelSessionManager;
  private readonly globalWaitSeconds: number;
  private readonly idleTimeoutMs: number;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor() {
    const steelLocal = (process.env.STEEL_LOCAL ?? "true") === "true";
    const apiKey = process.env.STEEL_API_KEY || undefined;
    let baseUrl = process.env.STEEL_BASE_URL || "https://api.steel.dev";
    if (steelLocal && !process.env.STEEL_BASE_URL) {
      baseUrl = "http://localhost:3000";
    }

    if (!steelLocal && !apiKey) {
      throw new Error("STEEL_API_KEY must be set when STEEL_LOCAL is 'false'.");
    }

    const defaultTimeoutMs = Number(process.env.STEEL_SESSION_TIMEOUT_MS) || 900000;
    this.globalWaitSeconds = Number(process.env.STEEL_GLOBAL_WAIT_SECONDS) || 0;
    this.idleTimeoutMs = Number(process.env.STEEL_IDLE_TIMEOUT_MS) || 600000;

    this.sessionManager = new SteelSessionManager({
      baseUrl,
      apiKey,
      isLocal: steelLocal,
      defaultTimeoutMs,
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: "session_create",
        description: "Create a new stateful Steel browser session (releases any existing session).",
        inputSchema: {
          type: "object",
          properties: {
            timeoutMs: {
              type: "number",
              description: "Session timeout in milliseconds.",
            },
            useProxy: {
              type: "boolean",
              description: "Enable Steel's automatic proxy rotation.",
            },
            solveCaptcha: {
              type: "boolean",
              description: "Enable Steel's CAPTCHA solving.",
            },
            userAgent: {
              type: "string",
              description: "Custom user agent string for the session.",
            },
          },
          required: [],
        },
      },
      {
        name: "session_release",
        description: "Release the current stateful Steel browser session.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "navigate",
        description: "Navigate to a specified URL in the stateful browser.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to navigate to." },
          },
          required: ["url"],
        },
      },
      {
        name: "search",
        description: "Perform a Google search by navigating to a results URL for the query.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Query text to search for." },
          },
          required: ["query"],
        },
      },
      {
        name: "click",
        description: "Click an element by its numeric label from the annotated snapshot.",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "number", description: "Element label number." },
          },
          required: ["label"],
        },
      },
      {
        name: "type",
        description: "Type text into an input element by its label. Optionally replace existing text.",
        inputSchema: {
          type: "object",
          properties: {
            label: { type: "number", description: "Element label number." },
            text: { type: "string", description: "Text to type." },
            replaceText: {
              type: "boolean",
              description: "Replace existing input text before typing.",
            },
          },
          required: ["label", "text"],
        },
      },
      {
        name: "scroll_down",
        description: "Scroll down by a number of pixels (or one page if omitted).",
        inputSchema: {
          type: "object",
          properties: {
            pixels: { type: "integer", description: "Pixels to scroll down." },
          },
          required: [],
        },
      },
      {
        name: "scroll_up",
        description: "Scroll up by a number of pixels (or one page if omitted).",
        inputSchema: {
          type: "object",
          properties: {
            pixels: { type: "integer", description: "Pixels to scroll up." },
          },
          required: [],
        },
      },
      {
        name: "go_back",
        description: "Navigate back in browser history.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "wait",
        description: "Wait for a number of seconds (0-10) for dynamic content to load.",
        inputSchema: {
          type: "object",
          properties: {
            seconds: {
              type: "number",
              description: "Seconds to wait (0-10).",
              minimum: 0,
              maximum: 10,
            },
          },
          required: ["seconds"],
        },
      },
      {
        name: "snapshot",
        description: "Return an annotated screenshot and list of labeled elements.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "snapshot_unmarked",
        description: "Return a screenshot without labels or bounding boxes.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "page_content",
        description: "Return the current page content as HTML or text.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["html", "text"],
              description: "Content format to return.",
              default: "html",
            },
          },
          required: [],
        },
      },
    ];
  }

  isTool(name: string): boolean {
    return this.getTools().some((tool) => tool.name === name);
  }

  async cleanup(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    await this.sessionManager.releaseSession();
  }

  private scheduleIdleRelease(): void {
    if (this.idleTimeoutMs <= 0) {
      return;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(async () => {
      await this.sessionManager.releaseSession();
    }, this.idleTimeoutMs);
    this.idleTimer.unref?.();
  }

  private async attachSnapshot(result: CallToolResult, includeLabels: boolean): Promise<CallToolResult> {
    const { labels, imageBase64 } = await this.sessionManager.annotateAndScreenshot();
    const content = result.content ?? [];
    if (includeLabels) {
      content.push({
        type: "text",
        text: `Labeled elements:\n${formatLabelText(labels)}`,
      });
    }
    content.push({
      type: "image",
      data: imageBase64,
      mimeType: "image/png",
    });
    return { ...result, content };
  }

  async handleTool(name: string, args: any): Promise<CallToolResult> {
    const startTime = Date.now();
    try {
      let result: CallToolResult;
      switch (name) {
        case "session_create": {
          await this.sessionManager.releaseSession();
          await this.sessionManager.ensureSession({
            timeoutMs: args?.timeoutMs,
            useProxy: args?.useProxy,
            solveCaptcha: args?.solveCaptcha,
            userAgent: args?.userAgent,
          });
          result = {
            content: [{ type: "text", text: "Session created and connected." }],
          };
          return this.attachSnapshot(result, true);
        }
        case "session_release": {
          await this.sessionManager.releaseSession();
          return {
            content: [{ type: "text", text: "Session released." }],
          };
        }
        case "navigate": {
          const url = args?.url;
          if (!url) {
            return {
              isError: true,
              content: [{ type: "text", text: "URL parameter is required." }],
            };
          }
          const page = await this.sessionManager.ensureSession();
          const normalized = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
          await page.goto(normalized);
          result = { content: [{ type: "text", text: `Navigated to ${normalized}` }] };
          break;
        }
        case "search": {
          const query = args?.query;
          if (!query) {
            return {
              isError: true,
              content: [{ type: "text", text: "Query parameter is required." }],
            };
          }
          const page = await this.sessionManager.ensureSession();
          const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          await page.goto(url);
          result = { content: [{ type: "text", text: `Searched Google for "${query}"` }] };
          break;
        }
        case "click": {
          const label = args?.label;
          if (label === undefined || label === null) {
            return {
              isError: true,
              content: [{ type: "text", text: "Label parameter is required." }],
            };
          }
          const page = await this.sessionManager.ensureSession();
          const selector = `[data-label="${label}"]`;
          await page.waitForSelector(selector, { state: "visible" });
          const targetBlank = await page.$eval(selector, (element) => {
            const anchor = element.closest("a");
            if (anchor && anchor.target === "_blank" && anchor instanceof HTMLAnchorElement) {
              return anchor.href;
            }
            return null;
          });
          if (targetBlank) {
            await page.goto(targetBlank);
          } else {
            await page.click(selector);
          }
          result = { content: [{ type: "text", text: `Clicked element ${label}.` }] };
          break;
        }
        case "type": {
          const label = args?.label;
          const text = args?.text;
          const replaceText = Boolean(args?.replaceText);
          if (label === undefined || label === null || typeof text !== "string") {
            return {
              isError: true,
              content: [{ type: "text", text: "Label and text parameters are required." }],
            };
          }
          const page = await this.sessionManager.ensureSession();
          const selector = `[data-label="${label}"]`;
          await page.waitForSelector(selector, { state: "visible" });
          if (replaceText) {
            await page.$eval(
              selector,
              (el, value) => {
                const input = el as HTMLInputElement;
                input.value = value as string;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              },
              text
            );
          } else {
            await page.$eval(
              selector,
              (el, value) => {
                const input = el as HTMLInputElement;
                input.value = (input.value ?? "") + (value as string);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              },
              text
            );
          }
          result = { content: [{ type: "text", text: `Typed into element ${label}.` }] };
          break;
        }
        case "scroll_down": {
          const pixels = args?.pixels;
          const page = await this.sessionManager.ensureSession();
          if (typeof pixels === "number") {
            await page.evaluate((amount) => window.scrollBy(0, amount), pixels);
          } else {
            await page.keyboard.press("PageDown");
          }
          result = { content: [{ type: "text", text: `Scrolled down${pixels ? ` by ${pixels}px` : ""}.` }] };
          break;
        }
        case "scroll_up": {
          const pixels = args?.pixels;
          const page = await this.sessionManager.ensureSession();
          if (typeof pixels === "number") {
            await page.evaluate((amount) => window.scrollBy(0, -amount), pixels);
          } else {
            await page.keyboard.press("PageUp");
          }
          result = { content: [{ type: "text", text: `Scrolled up${pixels ? ` by ${pixels}px` : ""}.` }] };
          break;
        }
        case "go_back": {
          const page = await this.sessionManager.ensureSession();
          const response = await page.goBack({ waitUntil: "domcontentloaded" });
          if (!response) {
            return {
              isError: true,
              content: [{ type: "text", text: "Cannot go back. No history entry." }],
            };
          }
          result = { content: [{ type: "text", text: "Went back to the previous page." }] };
          break;
        }
        case "wait": {
          const seconds = args?.seconds;
          if (typeof seconds !== "number" || seconds < 0 || seconds > 10) {
            return {
              isError: true,
              content: [{ type: "text", text: "Seconds must be between 0 and 10." }],
            };
          }
          await sleep(seconds * 1000);
          result = { content: [{ type: "text", text: `Waited ${seconds} second(s).` }] };
          break;
        }
        case "snapshot": {
          const snapshot = await this.sessionManager.annotateAndScreenshot();
          return {
            content: [
              { type: "text", text: `Labeled elements:\n${formatLabelText(snapshot.labels)}` },
              { type: "image", data: snapshot.imageBase64, mimeType: "image/png" },
            ],
          };
        }
        case "snapshot_unmarked": {
          const imageBase64 = await this.sessionManager.screenshotUnmarked();
          return {
            content: [{ type: "image", data: imageBase64, mimeType: "image/png" }],
          };
        }
        case "page_content": {
          const format = args?.format === "text" ? "text" : "html";
          const page = await this.sessionManager.ensureSession();
          if (format === "text") {
            const text = await page.evaluate(() => document.body?.innerText || "");
            return { content: [{ type: "text", text }] };
          }
          const html = await page.content();
          return { content: [{ type: "text", text: html }] };
        }
        default: {
          return {
            isError: true,
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
          };
        }
      }

      if (this.globalWaitSeconds > 0) {
        await sleep(this.globalWaitSeconds * 1000);
      }

      const duration = Date.now() - startTime;
      result.content = result.content ?? [];
      result.content.push({ type: "text", text: `Action completed in ${duration}ms.` });
      return this.attachSnapshot(result, true);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Tool ${name} failed: ${(error as Error).message}`,
          },
        ],
      };
    } finally {
      this.scheduleIdleRelease();
    }
  }
}

export type { Mode };
