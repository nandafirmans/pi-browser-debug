# pi-browser-debug

Pi extension for debugging active browser sessions via Chrome DevTools Protocol (CDP).

## Setup

Start your browser with remote debugging enabled:

```bash
# Chrome / Chromium / Edge
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
chrome.exe --remote-debugging-port=9222
```

## Install

```bash
# From git
pi install git:github.com/yourname/pi-browser-debug

# From local path (for development)
pi install ./path/to/pi-browser-debug
```

## Tools

| Tool | Description |
|------|-------------|
| `browser_connect` | Connect to active browser via CDP |
| `browser_list_pages` | List all open tabs |
| `browser_console` | Capture console logs |
| `browser_network` | Capture failed/slow network requests |
| `browser_eval` | Execute JS in page context |
| `browser_storage` | Inspect localStorage / cookies |
| `browser_snapshot` | Get accessibility tree |
| `browser_click` | Click element by selector or name |
| `browser_fill` | Fill form input |
| `browser_reload` | Reload page |
| `browser_close` | Close CDP connection |

## Usage in Pi

```
Connect to my browser on port 9222
Get console logs
Evaluate document.querySelectorAll('.error').length
```

Or call tools directly:

```
/browser_connect port=9222
/browser_console level=error
/browser_eval code="location.href"
```

## Requirements

- Pi coding agent
- Playwright (`npm install playwright` or let pi install it)
- Chrome / Chromium / Edge with `--remote-debugging-port=9222`
