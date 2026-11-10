# Pixel Art Studio

Pixel Art Studio is a retro sprite and pixel animation tool built for Nexus Arcade OS.

## Features

- **Configurable Grid Size:** Create sprites from 8×8 up to 128×128 pixels.
- **Retro Palettes:** Choose from authentic classic palettes:
  - PICO-8 (16 colors)
  - Game Boy (4 shades)
  - Commodore 64 (16 colors)
  - NES Classic (16 colors)
  - Custom palette with hex color picker.
- **Drawing Tools:**
  - **Pencil (`B`):** Single-pixel draw with Bresenham line interpolation.
  - **Eraser (`E`):** Clear pixels back to transparency.
  - **Fill Bucket (`G`):** 4-way queue flood fill.
  - **Line (`L`), Rectangle (`U`), Circle (`C`):** Geometric pixel primitives.
  - **Eyedropper (`I`):** Sample color from the canvas.
- **Bilateral Symmetry:** Toggle horizontal mirror mode to draw symmetrical sprites and characters.
- **Animation Timeline:**
  - Add, duplicate, and delete animation frames.
  - Adjustable frame rate (2 to 24 FPS).
  - Playback preview directly in the editor.
  - **Onion Skinning:** View translucent ghostly outline of previous frames for smooth animation.
- **Multi-Format Export:**
  - High-resolution scaled PNGs (1x to 32x).
  - Horizontal Sprite Sheets for game development.
  - **Animated GIF:** Zero-dependency GIF89a export with looping.
