# Clipboard Manager

Clipboard history, pinned clips, and smart text snippets with dynamic variables.

## Features

- **Automatic History**: Captures text copied inside Nexus OS apps with timestamps and origin app indicators.
- **Privacy First**: Sensitive copies from Password Vault and password fields are automatically excluded from history.
- **Pinned Clips**: Pin important clips so they are preserved even if the general history is cleared.
- **Search & Filter**: Quickly find any past clip or snippet by searching full-text contents and source apps.
- **Snippets with Variables**: Define reusable text templates with dynamic variables:
  - `{{date}}` — Current date (`YYYY-MM-DD`)
  - `{{time}}` — Current time (`HH:MM`)
  - `{{datetime}}` — Combined date and time
  - `{{clipboard}}` — The current clipboard contents
- **One-Click Copy & Terminal**: Instantly copy any clip back to your clipboard, or manage clips from the terminal with `clipboard list`, `clipboard copy <id>`, and `clipboard snippet <title>`.
