# pi-browser-debug

Pi extension for debugging active browser sessions via Chrome DevTools Protocol (CDP).

## Setup

Start your browser with remote debugging enabled:

**macOS**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Linux**
```bash
# If you get "Opening in existing browser session", use --user-data-dir to force a new instance
google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

**Windows**
```bash
chrome.exe --remote-debugging-port=9222
```

> **Tip:** Keep the terminal open. Closing it kills the browser instance.

## Install

```bash
# From npm
pi install npm:pi-browser-debug

# From git
pi install git:github.com/nandafirmans/pi-browser-debug

# From local path (for development)
pi install ./path/to/pi-browser-debug
```

## Tools

| Tool | Description |
|------|-------------|
| `browser_connect` | Connect to active browser via CDP |
| `browser_navigate` | Navigate to URL with proper load handling |
| `browser_list_pages` | List all open tabs |
| `browser_console` | Capture console logs |
| `browser_network` | Capture failed/slow network requests |
| `browser_eval` | Execute JS in page context |
| `browser_storage` | Inspect localStorage / cookies |
| `browser_snapshot` | Get accessibility tree |
| `browser_click` | Click element by selector or name |
| `browser_fill` | Fill form input |
| `browser_reload` | Reload page |
| `browser_screenshot` | Take screenshot of page or element |
| `browser_close` | Close CDP connection |

## Usage in Pi

Natural language:
```
Connect to my browser on port 9222
Navigate to https://localhost:5003
Get console logs
Take a screenshot
```

Direct tool calls:
```
/browser_connect port=9222
/browser_navigate url=https://localhost:5003 waitUntil=networkidle
/browser_console level=error
/browser_network filter=failed
/browser_screenshot fullPage=true
/browser_eval code="document.querySelectorAll('.error').length"
```

## Requirements

- Pi coding agent
- Playwright (`npm install playwright` or let pi install it)
- Chrome / Chromium / Edge with `--remote-debugging-port=9222`
