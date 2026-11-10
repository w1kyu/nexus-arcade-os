import { describe, expect, it } from 'vitest';
import { addPage, createPdfDoc, movePage, removePage, rotatePage } from '../../src/apps/pdf/model.js';
import { buildPdfFromJpegPages, PAGE_SIZES } from '../../src/apps/pdf/pdf-generator.js';

describe('PDF Tools Model & PDF Generator', () => {
  describe('Document State & Page Manipulations', () => {
    it('creates an empty PDF doc state', () => {
      const doc = createPdfDoc('Scanned Receipts');
      expect(doc.title).toBe('Scanned Receipts');
      expect(doc.pages.length).toBe(0);
      expect(doc.pageSize).toBe('a4');
      expect(doc.orientation).toBe('portrait');
    });

    it('adds, rotates, moves, and removes image pages', () => {
      const doc = createPdfDoc();
      addPage(doc, 'Page 1', 'data:image/png;base64,sample1', 800, 600);
      addPage(doc, 'Page 2', 'data:image/png;base64,sample2', 800, 600);
      addPage(doc, 'Page 3', 'data:image/png;base64,sample3', 800, 600);

      expect(doc.pages.length).toBe(3);
      expect(doc.pages[0].name).toBe('Page 1');

      // Rotate page 0
      rotatePage(doc, 0);
      expect(doc.pages[0].rotation).toBe(90);
      rotatePage(doc, 0);
      expect(doc.pages[0].rotation).toBe(180);

      // Move page 2 to index 0
      movePage(doc, 2, 0);
      expect(doc.pages[0].name).toBe('Page 3');
      expect(doc.pages[1].name).toBe('Page 1');

      // Remove page
      removePage(doc, 1);
      expect(doc.pages.length).toBe(2);
      expect(doc.pages[1].name).toBe('Page 2');
    });
  });

  describe('Pure JS PDF 1.4 Binary Generator', () => {
    it('generates a valid single-page PDF binary with standard header and trailer', () => {
      // Mock 1x1 JPEG byte stream
      const mockJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
      const pdfBytes = buildPdfFromJpegPages([
        {
          widthPt: PAGE_SIZES.a4.widthPt,
          heightPt: PAGE_SIZES.a4.heightPt,
          jpegBytes: mockJpegBytes,
          imgWidth: 100,
          imgHeight: 100,
        },
      ]);

      expect(pdfBytes instanceof Uint8Array).toBe(true);
      expect(pdfBytes.length).toBeGreaterThan(100);

      const pdfText = new TextDecoder().decode(pdfBytes);
      expect(pdfText).toContain('%PDF-1.4');
      expect(pdfText).toContain('/Type /Catalog');
      expect(pdfText).toContain('/Type /Pages');
      expect(pdfText).toContain('/Type /Page');
      expect(pdfText).toContain('/Type /XObject');
      expect(pdfText).toContain('/Filter /DCTDecode');
      expect(pdfText).toContain('xref');
      expect(pdfText).toContain('trailer');
      expect(pdfText).toContain('startxref');
      expect(pdfText).toContain('%%EOF');
    });

    it('generates a valid multi-page PDF binary', () => {
      const mockJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      const pdfBytes = buildPdfFromJpegPages([
        {
          widthPt: 595.28,
          heightPt: 841.89,
          jpegBytes: mockJpegBytes,
          imgWidth: 200,
          imgHeight: 300,
        },
        {
          widthPt: 612.0,
          heightPt: 792.0,
          jpegBytes: mockJpegBytes,
          imgWidth: 400,
          imgHeight: 500,
        },
      ]);

      const pdfText = new TextDecoder().decode(pdfBytes);
      expect(pdfText).toContain('/Count 2');
      expect(pdfText).toContain('3 0 R 6 0 R');
      expect(pdfText).toContain('%%EOF');
    });
  });
});
