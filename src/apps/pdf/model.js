// @ts-check
import { buildPdfFromJpegPages, PAGE_SIZES } from './pdf-generator.js';

let nextPageId = 1;

/**
 * @typedef {object} ScannedPage
 * @property {string} id
 * @property {string} name
 * @property {string} dataUrl
 * @property {number} width
 * @property {number} height
 * @property {number} rotation // 0, 90, 180, 270
 */

/**
 * @typedef {object} PdfDocState
 * @property {string} title
 * @property {string | null} pdfBlobUrl
 * @property {Uint8Array | null} pdfBytes
 * @property {ScannedPage[]} pages
 * @property {'a4' | 'letter' | 'auto'} pageSize
 * @property {'portrait' | 'landscape'} orientation
 */

/**
 * Create a new PDF tools state.
 * @param {string} [title='Document']
 * @returns {PdfDocState}
 */
export function createPdfDoc(title = 'Document') {
  return {
    title,
    pdfBlobUrl: null,
    pdfBytes: null,
    pages: [],
    pageSize: 'a4',
    orientation: 'portrait',
  };
}

/**
 * Add a scanned or imported image page.
 * @param {PdfDocState} doc
 * @param {string} name
 * @param {string} dataUrl
 * @param {number} width
 * @param {number} height
 */
export function addPage(doc, name, dataUrl, width, height) {
  doc.pages.push({
    id: `page_${Date.now()}_${nextPageId++}`,
    name,
    dataUrl,
    width,
    height,
    rotation: 0,
  });
}

/**
 * Rotate a page clockwise by 90 degrees.
 * @param {PdfDocState} doc
 * @param {number} index
 */
export function rotatePage(doc, index) {
  const page = doc.pages[index];
  if (page) {
    page.rotation = (page.rotation + 90) % 360;
  }
}

/**
 * Remove a page from the document.
 * @param {PdfDocState} doc
 * @param {number} index
 */
export function removePage(doc, index) {
  if (index >= 0 && index < doc.pages.length) {
    doc.pages.splice(index, 1);
  }
}

/**
 * Move a page from one index to another.
 * @param {PdfDocState} doc
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function movePage(doc, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= doc.pages.length || toIndex < 0 || toIndex >= doc.pages.length) {
    return;
  }
  const [removed] = doc.pages.splice(fromIndex, 1);
  doc.pages.splice(toIndex, 0, removed);
}

/**
 * Convert dataURL (PNG/JPG/WebP) to JPEG Uint8Array using canvas.
 * @param {string} dataUrl
 * @param {number} rotation
 * @returns {Promise<{ jpegBytes: Uint8Array, width: number, height: number }>}
 */
export async function processImageToJpeg(dataUrl, rotation = 0) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const isRotated = rotation === 90 || rotation === 270;
      const targetW = isRotated ? img.naturalHeight : img.naturalWidth;
      const targetH = isRotated ? img.naturalWidth : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);

      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = jpegDataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      resolve({
        jpegBytes: bytes,
        width: targetW,
        height: targetH,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Compile pages into a PDF binary.
 * @param {PdfDocState} doc
 * @returns {Promise<Uint8Array>}
 */
export async function generatePdfBinary(doc) {
  if (doc.pages.length === 0) {
    throw new Error('No pages to generate PDF from');
  }

  const standardSize = PAGE_SIZES[doc.pageSize] || PAGE_SIZES.a4;
  const isLandscape = doc.orientation === 'landscape';

  const processedPages = await Promise.all(doc.pages.map((p) => processImageToJpeg(p.dataUrl, p.rotation)));

  const pdfPages = processedPages.map((p) => {
    let widthPt = standardSize.widthPt;
    let heightPt = standardSize.heightPt;

    if (doc.pageSize === 'auto' || widthPt === 0) {
      // 72 DPI translation from pixel dimensions
      widthPt = (p.width * 72) / 96;
      heightPt = (p.height * 72) / 96;
    } else if (isLandscape) {
      // Swap width and height for landscape
      const tmp = widthPt;
      widthPt = heightPt;
      heightPt = tmp;
    }

    return {
      widthPt,
      heightPt,
      jpegBytes: p.jpegBytes,
      imgWidth: p.width,
      imgHeight: p.height,
    };
  });

  return buildPdfFromJpegPages(pdfPages);
}
