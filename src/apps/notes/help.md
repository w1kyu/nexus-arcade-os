# Nexus Notes

Nexus Notes is a Markdown knowledge base stored as plain `.md` files in `Documents/Notes` inside the Nexus virtual file system.

## Features

- **Modes:** Edit, Split (synchronized scrolling), and Preview.
- **Markdown & Math:** GitHub-Flavored Markdown (tables, task lists, footnotes), syntax-highlighted fenced code blocks, and KaTeX math (`$E = mc^2$` and `$$…$$`).
- **Wiki Links & Backlinks:** Link notes with `[[Note Title]]` or `[[Note Title|Alias]]` with autocomplete; inspect incoming links in the Backlinks panel or Graph View.
- **Per-note Encryption:** Protect sensitive notes with AES-GCM-256 (`PBKDF2-SHA256`, 600,000 iterations) and automatic lock after inactivity. _Warning: a forgotten password cannot be recovered._
- **Import & Export:** Import `.md`/`.txt` files or folders; export single notes as `.md`/`.html`/PDF or all notes as `.zip` or `.json`.
