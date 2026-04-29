import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { chromium } from "playwright";

export default function (pi: ExtensionAPI) {
  let browser: any = null;
  let page: any = null;

  const ensureConnected = () => {
    if (!browser || !page) {
      throw new Error("Browser not connected. Call browser_connect first.");
    }
  };

  pi.registerTool({
    name: "browser_navigate",
    label: "Navigate to URL",
    description: "Navigate active page to URL. Handles load states, SSL errors, and timeouts.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to navigate to" }),
      waitUntil: Type.Optional(Type.String({ default: "load", description: "load, domcontentloaded, networkidle, commit" })),
      timeout: Type.Optional(Type.Number({ default: 30000, description: "Navigation timeout in ms" })),
    }),
    async execute(_id, params) {
      ensureConnected();
      try {
        const response = await page.goto(params.url, {
          waitUntil: params.waitUntil ?? "load",
          timeout: params.timeout ?? 30000,
        });
        const status = response?.status() ?? "no response";
        return {
          content: [{
            type: "text",
            text: `Navigated to: ${page.url()}\nHTTP status: ${status}\nTitle: ${await page.title()}`,
          }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Navigation failed: ${err.message}` }],
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "browser_screenshot",
    label: "Screenshot",
    description: "Take screenshot of active page or specific element",
    parameters: Type.Object({
      fullPage: Type.Optional(Type.Boolean({ default: false })),
      selector: Type.Optional(Type.String({ description: "CSS selector of element to screenshot" })),
    }),
    async execute(_id, params) {
      ensureConnected();
      let buffer: Buffer;
      if (params.selector) {
        const el = page.locator(params.selector);
        buffer = await el.screenshot();
      } else {
        buffer = await page.screenshot({ fullPage: params.fullPage ?? false });
      }
      const b64 = buffer.toString("base64");
      return {
        content: [
          { type: "text", text: `Screenshot taken (${b64.length} chars base64)` },
          { type: "image", source: { type: "base64", mediaType: "image/png", data: b64 } },
        ],
      };
    },
  });

  pi.registerTool({
    name: "browser_connect",
    label: "Connect to Browser",
    description: "Connect to an active browser via Chrome DevTools Protocol (CDP). Start browser with --remote-debugging-port=9222 first.",
    parameters: Type.Object({
      port: Type.Optional(Type.Number({ default: 9222, description: "CDP port" })),
      url: Type.Optional(Type.String({ description: "Connect to page matching URL substring" })),
      pageIndex: Type.Optional(Type.Number({ default: -1, description: "Page index (-1 = last)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const port = params.port ?? 9222;
      browser = await chromium.connectOverCDP(`http://localhost:${port}`);
      const contexts = browser.contexts();
      if (contexts.length === 0) {
        throw new Error("No browser contexts found.");
      }

      const pages = contexts[0].pages();
      if (pages.length === 0) {
        throw new Error("No pages found in browser context.");
      }

      if (params.url) {
        page = pages.find((p: any) => p.url().includes(params.url));
        if (!page) {
          const urls = pages.map((p: any, i: number) => `${i}: ${p.url()}`).join("\n");
          throw new Error(`No page matching '${params.url}'. Available pages:\n${urls}`);
        }
      } else if (params.pageIndex !== undefined && params.pageIndex >= 0) {
        page = pages[params.pageIndex];
        if (!page) {
          throw new Error(`Page index ${params.pageIndex} out of range. ${pages.length} pages available.`);
        }
      } else {
        page = pages[pages.length - 1];
      }

      const info = pages.map((p: any, i: number) => `${i}: ${p.url()}`).join("\n");
      return {
        content: [{
          type: "text",
          text: `Connected to page: ${page.url()}\n\nAll pages (${pages.length}):\n${info}`,
        }],
      };
    },
  });

  pi.registerTool({
    name: "browser_list_pages",
    label: "List Browser Pages",
    description: "List all open pages/tabs in the connected browser",
    parameters: Type.Object({}),
    async execute() {
      ensureConnected();
      const contexts = browser.contexts();
      const pages = contexts[0]?.pages() ?? [];
      const list = pages.map((p: any, i: number) => `${i}: ${p.url()} (${p.title()})`).join("\n");
      return {
        content: [{ type: "text", text: `Pages: ${pages.length}\n${list}` }],
      };
    },
  });

  pi.registerTool({
    name: "browser_console",
    label: "Get Console Logs",
    description: "Get console logs from the active page. Must be called before action to capture logs.",
    parameters: Type.Object({
      level: Type.Optional(Type.String({ default: "all", description: "Filter: all, error, warn, info, log" })),
      clear: Type.Optional(Type.Boolean({ default: false, description: "Clear log buffer after read" })),
    }),
    async execute(_id, params) {
      ensureConnected();

      const logs: string[] = [];
      const listener = (msg: any) => {
        const type = msg.type();
        const text = msg.text();
        const level = params.level ?? "all";
        if (level !== "all" && type !== level) return;
        logs.push(`[${type}] ${text}`);
      };

      page.on("console", listener);

      // Wait a tick for any pending console events to flush
      await page.waitForTimeout(100);

      page.off("console", listener);

      return {
        content: [{
          type: "text",
          text: logs.length > 0 ? logs.join("\n") : "No console messages captured. Call this before or after actions.",
        }],
      };
    },
  });

  pi.registerTool({
    name: "browser_network",
    label: "Get Network Requests",
    description: "Get network requests from the active page",
    parameters: Type.Object({
      filter: Type.Optional(Type.String({ default: "failed", description: "failed, slow (>500ms), all" })),
    }),
    async execute(_id, params) {
      ensureConnected();

      const requests: any[] = [];
      const listener = async (res: any) => {
        const req = res.request();
        const status = res.status();
        const url = res.url();
        const timing = res.timing();

        const filter = params.filter ?? "failed";
        if (filter === "failed" && status < 400) return;
        if (filter === "slow" && (!timing || (timing.responseEnd - timing.startTime) < 500)) return;

        requests.push({ status, url, method: req.method() });
      };

      page.on("response", listener);
      await page.waitForTimeout(100);
      page.off("response", listener);

      const lines = requests.map((r) => `${r.status} ${r.method} ${r.url}`).join("\n");
      return {
        content: [{
          type: "text",
          text: requests.length > 0 ? lines : `No ${params.filter} requests captured.`,
        }],
      };
    },
  });

  pi.registerTool({
    name: "browser_eval",
    label: "Evaluate JavaScript",
    description: "Run JavaScript in the active page context",
    parameters: Type.Object({
      code: Type.String({ description: "JavaScript code to execute" }),
    }),
    async execute(_id, params) {
      ensureConnected();
      const result = await page.evaluate(params.code);
      return {
        content: [{
          type: "text",
          text: typeof result === "object" ? JSON.stringify(result, null, 2) : String(result),
        }],
      };
    },
  });

  pi.registerTool({
    name: "browser_storage",
    label: "Inspect Storage",
    description: "Get localStorage, sessionStorage, and cookies",
    parameters: Type.Object({
      type: Type.Optional(Type.String({ default: "all", description: "all, localStorage, sessionStorage, cookies" })),
    }),
    async execute(_id, params) {
      ensureConnected();
      const data: Record<string, any> = {};

      if (params.type === "all" || params.type === "localStorage") {
        data.localStorage = await page.evaluate(() => ({ ...localStorage }));
      }
      if (params.type === "all" || params.type === "sessionStorage") {
        data.sessionStorage = await page.evaluate(() => ({ ...sessionStorage }));
      }
      if (params.type === "all" || params.type === "cookies") {
        data.cookies = await page.context().cookies();
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2),
        }],
      };
    },
  });

  pi.registerTool({
    name: "browser_snapshot",
    label: "Page Snapshot",
    description: "Get accessibility tree snapshot of active page",
    parameters: Type.Object({
      compact: Type.Optional(Type.Boolean({ default: true })),
    }),
    async execute(_id, params) {
      ensureConnected();
      const snapshot = await page.accessibility.snapshot();
      const text = params.compact !== false
        ? JSON.stringify(snapshot, null, 2).slice(0, 15000)
        : JSON.stringify(snapshot, null, 2);
      return {
        content: [{ type: "text", text }],
      };
    },
  });

  pi.registerTool({
    name: "browser_click",
    label: "Click Element",
    description: "Click element by accessible name or selector",
    parameters: Type.Object({
      selector: Type.Optional(Type.String({ description: "CSS selector" })),
      name: Type.Optional(Type.String({ description: "Accessible name (aria-label, text content)" })),
      role: Type.Optional(Type.String({ default: "button", description: "ARIA role when using name" })),
    }),
    async execute(_id, params) {
      ensureConnected();
      if (params.selector) {
        await page.locator(params.selector).click();
      } else if (params.name) {
        await page.getByRole(params.role as any, { name: params.name }).click();
      } else {
        throw new Error("Provide selector or name.");
      }
      return {
        content: [{ type: "text", text: "Clicked." }],
      };
    },
  });

  pi.registerTool({
    name: "browser_fill",
    label: "Fill Input",
    description: "Fill form input by selector or label",
    parameters: Type.Object({
      selector: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      value: Type.String(),
    }),
    async execute(_id, params) {
      ensureConnected();
      if (params.selector) {
        await page.locator(params.selector).fill(params.value);
      } else if (params.name) {
        await page.getByLabel(params.name).fill(params.value);
      } else {
        throw new Error("Provide selector or name.");
      }
      return {
        content: [{ type: "text", text: "Filled." }],
      };
    },
  });

  pi.registerTool({
    name: "browser_reload",
    label: "Reload Page",
    description: "Reload the active page",
    parameters: Type.Object({
      waitFor: Type.Optional(Type.String({ description: "Wait for selector or 'networkidle'" })),
    }),
    async execute(_id, params) {
      ensureConnected();
      if (params.waitFor === "networkidle") {
        await page.reload({ waitUntil: "networkidle" });
      } else if (params.waitFor) {
        await page.reload();
        await page.waitForSelector(params.waitFor);
      } else {
        await page.reload();
      }
      return {
        content: [{ type: "text", text: `Reloaded: ${page.url()}` }],
      };
    },
  });

  pi.registerTool({
    name: "browser_close",
    label: "Close Connection",
    description: "Close browser CDP connection",
    parameters: Type.Object({}),
    async execute() {
      if (browser) {
        await browser.close();
        browser = null;
        page = null;
      }
      return {
        content: [{ type: "text", text: "Browser connection closed." }],
      };
    },
  });
}
