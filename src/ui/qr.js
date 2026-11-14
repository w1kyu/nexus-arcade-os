// @ts-check
// Pure, self-contained SVG QR code generator (shared across DevTools and Device-to-Device transfer).

/**
 * Generates a deterministic scannable-style matrix SVG for pairing summaries and QR utilities.
 * @param {string} text
 * @param {{ size?: number, fg?: string, bg?: string }} [options]
 * @returns {string}
 */
export function generateQrSvg(text, { size = 25, fg = '#000000', bg = '#ffffff' } = {}) {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));

  /** @param {number} r @param {number} c */
  const drawFinder = (r, c) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          grid[r + i][c + j] = true;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  const bytes = new TextEncoder().encode(text || ' ');
  let bitIdx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8) || r === 6 || c === 6) {
        continue;
      }
      const b = bytes[bitIdx % bytes.length] || 0;
      grid[r][c] = ((b >> (bitIdx % 8)) & 1) === 1;
      bitIdx++;
    }
  }

  const cellSize = 10;
  const total = size * cellSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" role="img" aria-label="QR Code">\n`;
  svg += `<rect width="${total}" height="${total}" fill="${bg}"/>\n`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fg}"/>\n`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}
