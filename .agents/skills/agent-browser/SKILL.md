# agent-browser

Headless browser automation CLI for AI agents. Use this skill when you need to interact with web pages, automate browser tasks, scrape data, or test web applications.

## Core Workflow

The optimal workflow for AI agents follows a snapshot-based approach:

1. **Navigate** - Open the target URL
2. **Snapshot** - Get interactive elements with refs (@e1, @e2, ...)
3. **Interact** - Use refs for deterministic element selection
4. **Re-snapshot** - Get new refs after page changes

```bash
agent-browser open <url>
agent-browser snapshot -i          # Get interactive elements with refs
agent-browser click @e2            # Interact using refs
agent-browser fill @e3 "text"      # Fill input by ref
agent-browser snapshot -i          # Re-snapshot after changes
```

## Why Use Refs

Refs provide deterministic element selection from snapshots:

- **Deterministic**: Ref points to exact element from snapshot
- **Fast**: No DOM re-query needed
- **AI-friendly**: Snapshot + ref workflow is optimal for LLMs
- **93% context reduction**: Compared to full DOM or screenshot approaches

## Command Reference

### Navigation

| Command      | Description                                   |
| ------------ | --------------------------------------------- |
| `open <url>` | Navigate to URL (aliases: `goto`, `navigate`) |
| `back`       | Go back in history                            |
| `forward`    | Go forward in history                         |
| `reload`     | Reload current page                           |
| `close`      | Close browser (aliases: `quit`, `exit`)       |

### Element Interaction

| Command                | Description                       |
| ---------------------- | --------------------------------- |
| `click <sel>`          | Click element                     |
| `dblclick <sel>`       | Double-click element              |
| `fill <sel> <text>`    | Clear and fill input              |
| `type <sel> <text>`    | Type character by character       |
| `press <key>`          | Press key (Enter, Tab, Control+a) |
| `hover <sel>`          | Hover over element                |
| `select <sel> <val>`   | Select dropdown option            |
| `check <sel>`          | Check checkbox                    |
| `uncheck <sel>`        | Uncheck checkbox                  |
| `focus <sel>`          | Focus element                     |
| `scroll <dir> [px]`    | Scroll (up/down/left/right)       |
| `scrollintoview <sel>` | Scroll element into view          |
| `drag <src> <tgt>`     | Drag and drop                     |
| `upload <sel> <files>` | Upload files                      |

### Get Information

| Command                 | Description             |
| ----------------------- | ----------------------- |
| `get text <sel>`        | Get text content        |
| `get html <sel>`        | Get innerHTML           |
| `get value <sel>`       | Get input value         |
| `get attr <sel> <attr>` | Get attribute           |
| `get title`             | Get page title          |
| `get url`               | Get current URL         |
| `get count <sel>`       | Count matching elements |
| `get box <sel>`         | Get bounding box        |

### State Checks

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `is visible <sel>` | Check if element is visible  |
| `is enabled <sel>` | Check if element is enabled  |
| `is checked <sel>` | Check if checkbox is checked |

### Snapshot & Capture

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `snapshot`          | Get accessibility tree with refs        |
| `snapshot -i`       | Interactive elements only (recommended) |
| `snapshot -c`       | Compact mode (remove empty elements)    |
| `snapshot -d <n>`   | Limit depth to n levels                 |
| `snapshot -s <sel>` | Scope to CSS selector                   |
| `screenshot [path]` | Take screenshot                         |
| `screenshot --full` | Full page screenshot                    |
| `pdf <path>`        | Save page as PDF                        |

### Wait Commands

| Command                   | Description                    |
| ------------------------- | ------------------------------ |
| `wait <sel>`              | Wait for element to be visible |
| `wait <ms>`               | Wait for milliseconds          |
| `wait --text "..."`       | Wait for text to appear        |
| `wait --url "pattern"`    | Wait for URL pattern           |
| `wait --load networkidle` | Wait for network idle          |
| `wait --fn "expression"`  | Wait for JS condition          |

### Semantic Locators (find)

| Command                          | Description            |
| -------------------------------- | ---------------------- |
| `find role <role> <action>`      | Find by ARIA role      |
| `find text <text> <action>`      | Find by text content   |
| `find label <label> <action>`    | Find by label          |
| `find placeholder <ph> <action>` | Find by placeholder    |
| `find testid <id> <action>`      | Find by data-testid    |
| `find first <sel> <action>`      | First matching element |
| `find last <sel> <action>`       | Last matching element  |
| `find nth <n> <sel> <action>`    | Nth matching element   |

**Actions**: `click`, `fill`, `check`, `hover`, `text`

**Examples**:

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "test@example.com"
```

### Session Management

```bash
agent-browser --session agent1 open site.com  # Use named session
agent-browser session list                     # List active sessions
agent-browser session                          # Show current session
```

### Cookies & Storage

```bash
agent-browser cookies                    # Get all cookies
agent-browser cookies set <name> <val>   # Set cookie
agent-browser cookies clear              # Clear cookies
agent-browser storage local              # Get localStorage
agent-browser storage local set <k> <v>  # Set localStorage
agent-browser storage session            # Get sessionStorage
```

### Frames & Dialogs

```bash
agent-browser frame <sel>        # Switch to iframe
agent-browser frame main         # Back to main frame
agent-browser dialog accept      # Accept dialog
agent-browser dialog dismiss     # Dismiss dialog
```

### Tabs

```bash
agent-browser tab            # List tabs
agent-browser tab new [url]  # New tab
agent-browser tab <n>        # Switch to tab n
agent-browser tab close [n]  # Close tab
```

## Selector Types

### 1. Refs (Recommended)

```bash
agent-browser snapshot -i
# Output: button "Submit" [ref=e2]
agent-browser click @e2
```

### 2. CSS Selectors

```bash
agent-browser click "#submit"
agent-browser click ".btn-primary"
agent-browser click "div > button"
```

### 3. Text & XPath

```bash
agent-browser click "text=Submit"
agent-browser click "xpath=//button[@type='submit']"
```

## Options

| Option                     | Description                          |
| -------------------------- | ------------------------------------ |
| `--session <name>`         | Use isolated session                 |
| `--json`                   | JSON output (for parsing)            |
| `--headed`                 | Show browser window                  |
| `--full, -f`               | Full page screenshot                 |
| `--name, -n`               | Locator name filter                  |
| `--exact`                  | Exact text match                     |
| `--debug`                  | Debug output                         |
| `--headers <json>`         | Set HTTP headers for origin          |
| `--executable-path <path>` | Custom browser executable            |
| `--cdp <port>`             | Connect via Chrome DevTools Protocol |

## Common Patterns

### Login Flow

```bash
agent-browser open https://example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "username"
agent-browser fill @e2 "password"
agent-browser click @e3  # Submit button
agent-browser wait --url "**/dashboard"
agent-browser snapshot -i
```

### Form Submission

```bash
agent-browser open https://example.com/form
agent-browser snapshot -i
agent-browser fill @e1 "John Doe"
agent-browser fill @e2 "john@example.com"
agent-browser select @e3 "Option A"
agent-browser check @e4
agent-browser click @e5  # Submit
agent-browser wait --text "Success"
```

### Data Extraction

```bash
agent-browser open https://example.com/products
agent-browser snapshot -i --json
agent-browser get text @e1
agent-browser get attr @e2 "href"
agent-browser get html "#content"
```

### Screenshot for Verification

```bash
agent-browser open https://example.com
agent-browser wait --load networkidle
agent-browser screenshot page.png --full
```

### Multi-page Navigation

```bash
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser click @e2  # Navigate to page 2
agent-browser wait --load networkidle
agent-browser snapshot -i  # Get new refs
agent-browser click @e3  # Continue
```

### Authenticated Sessions

```bash
agent-browser open api.example.com --headers '{"Authorization": "Bearer <token>"}'
agent-browser snapshot -i --json
```

## Best Practices

1. **Always snapshot before interacting** - Get fresh refs after any page change
2. **Use `-i` flag** - Interactive-only snapshots reduce token usage significantly
3. **Use refs over CSS selectors** - More reliable and deterministic
4. **Wait for page stability** - Use `wait --load networkidle` after navigation
5. **Use `--json` for parsing** - Structured output is easier to process
6. **Re-snapshot after actions** - Page state changes invalidate previous refs
7. **Handle dynamic content** - Wait for specific text or elements to appear
8. **Use sessions for isolation** - Separate browser contexts for parallel tasks

## Error Handling

If an action fails:

1. Re-run `snapshot -i` to get current page state
2. Verify the target element exists in the new snapshot
3. Check if the page has changed or loaded new content
4. Use appropriate wait commands before retrying

## Environment Variables

| Variable                        | Description              |
| ------------------------------- | ------------------------ |
| `AGENT_BROWSER_SESSION`         | Default session name     |
| `AGENT_BROWSER_EXECUTABLE_PATH` | Custom browser path      |
| `AGENT_BROWSER_STREAM_PORT`     | WebSocket streaming port |
