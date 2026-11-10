# Nexus Present

Nexus Present is a lightweight Markdown-powered slide deck editor and presentation studio for Nexus Arcade OS.

## Slide Syntax

- Separate slides with three dashes on their own line (`---`).
- Standard Markdown formatting: headings (`#`, `##`), lists, bold/italics, quotes, tables, and fenced code blocks.
- **Math Formulas:** Supports inline `$E = mc^2$` and display blocks:
  ```
  $$\sum_{i=1}^n i = \frac{n(n+1)}{2}$$
  ```
- **Speaker Notes:** Add private notes to any slide using HTML comments or trailing `Note:` lines:
  ```markdown
  # Slide Title

  Slide content here.

  <!-- note: Remember to introduce the team members here. -->
  ```

## Presentation Modes

- **Slide Show (`F`):** Fullscreen distraction-free presentation mode.
- **Presenter View (`P`):** Split presenter console displaying:
  - High-resolution current slide preview
  - Next slide upcoming preview
  - Private speaker notes
  - Presentation stop watch and timer
- **Keyboard Navigation:**
  - `Right Arrow` / `Down Arrow` / `Space` / `Page Down`: Next slide
  - `Left Arrow` / `Up Arrow` / `Page Up` / `Backspace`: Previous slide
  - `Home` / `End`: Jump to first / last slide
  - `F`: Toggle Fullscreen
  - `P`: Open Presenter Mode

## Exporting

- **Standalone HTML:** Exports self-contained interactive web presentations with embedded styles and keyboard navigation. Works offline in any browser.
- **Print / PDF:** Open browser print dialog configured with slide page-breaks.
