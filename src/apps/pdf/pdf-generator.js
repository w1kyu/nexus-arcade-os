// @ts-check

/**
 * @typedef {object} PdfPageInput
 * @property {number} widthPt
 * @property {number} heightPt
 * @property {Uint8Array} jpegBytes
 * @property {number} imgWidth
 * @property {number} imgHeight
 */

/**
 * Generate a standard PDF 1.4 binary document containing one or more image pages.
 * @param {PdfPageInput[]} pages
 * @returns {Uint8Array}
 */
export function buildPdfFromJpegPages(pages) {
  /** @type {number[]} */
  const chunks = [];

  function writeAscii(str) {
    for (let i = 0; i < str.length; i++) {
      chunks.push(str.charCodeAt(i) & 0xff);
    }
  }

  function writeBytes(bytes) {
    for (let i = 0; i < bytes.length; i++) {
      chunks.push(bytes[i]);
    }
  }

  function currentOffset() {
    return chunks.length;
  }

  // Header
  writeAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  /** @type {number[]} */
  const xrefOffsets = [];

  // Obj 1: Catalog
  // Obj 2: Pages container
  // For each page:
  //   Obj 3 + 3*i: Page object
  //   Obj 4 + 3*i: Content stream (drawing the image)
  //   Obj 5 + 3*i: Image XObject (JPEG data)

  const numPages = pages.length;
  const catalogObjId = 1;
  const pagesObjId = 2;

  // 1. Catalog Object
  xrefOffsets[catalogObjId] = currentOffset();
  writeAscii(`${catalogObjId} 0 obj\n<< /Type /Catalog /Pages ${pagesObjId} 0 R >>\nendobj\n`);

  // Compute Page object IDs: 3, 6, 9, ...
  const pageObjIds = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(3 + 3 * i);
  }

  // 2. Pages Container Object
  xrefOffsets[pagesObjId] = currentOffset();
  writeAscii(
    `${pagesObjId} 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`,
  );

  // 3. Emit each page and its resources
  for (let i = 0; i < numPages; i++) {
    const page = pages[i];
    const pageId = 3 + 3 * i;
    const contentId = 4 + 3 * i;
    const imageId = 5 + 3 * i;

    // Page Object
    xrefOffsets[pageId] = currentOffset();
    writeAscii(
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${page.widthPt.toFixed(2)} ${page.heightPt.toFixed(2)}] /Contents ${contentId} 0 R /Resources << /XObject << /Im1 ${imageId} 0 R >> >> >>\nendobj\n`,
    );

    // Content Stream: Scale and draw Im1 to fill the page
    const contentData = `q\n${page.widthPt.toFixed(2)} 0 0 ${page.heightPt.toFixed(2)} 0 0 cm\n/Im1 Do\nQ\n`;
    xrefOffsets[contentId] = currentOffset();
    writeAscii(`${contentId} 0 obj\n<< /Length ${contentData.length} >>\nstream\n${contentData}endstream\nendobj\n`);

    // Image XObject: JPEG
    xrefOffsets[imageId] = currentOffset();
    writeAscii(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.imgWidth} /Height ${page.imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`,
    );
    writeBytes(page.jpegBytes);
    writeAscii('\nendstream\nendobj\n');
  }

  // Cross-reference table
  const startXrefOffset = currentOffset();
  const totalObjects = 2 + 3 * numPages; // 0 (free) + 1..N
  writeAscii(`xref\n0 ${totalObjects + 1}\n`);
  writeAscii('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    const offset = xrefOffsets[id] || 0;
    const padded = String(offset).padStart(10, '0');
    writeAscii(`${padded} 00000 n \n`);
  }

  // Trailer
  writeAscii(
    `trailer\n<< /Size ${totalObjects + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${startXrefOffset}\n%%EOF\n`,
  );

  return new Uint8Array(chunks);
}

/**
 * Standard page dimensions in points (1/72 inch).
 */
export const PAGE_SIZES = {
  a4: { name: 'A4', widthPt: 595.28, heightPt: 841.89 },
  letter: { name: 'US Letter', widthPt: 612.0, heightPt: 792.0 },
  auto: { name: 'Fit Image', widthPt: 0, heightPt: 0 },
};
