import { PDFDocument } from 'pdf-lib';
import type { NewPage } from '@/types/editor';

export async function loadPdfDocument(bytes: Uint8Array, sourceIndex: number = 0) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  const pages: NewPage[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;

    pages.push({
      id: `${sourceIndex}-${i}-${Date.now()}`,
      pageIndex: i,
      sourceIndex,
      rotation,
      width,
      height,
    });
  }

  return { pageCount, pages };
}
