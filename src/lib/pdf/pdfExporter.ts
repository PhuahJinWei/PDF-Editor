import { PDFDocument, degrees } from 'pdf-lib';
import type { EditorPage, PdfSource } from '@/types/editor';

export async function exportPdf(
  sources: PdfSource[],
  pages: EditorPage[],
  outputFileName: string,
) {
  const outputDoc = await PDFDocument.create();

  // Load all source PDFs
  const loadedSources = await Promise.all(
    sources.map((s) => PDFDocument.load(s.bytes, { ignoreEncryption: true }))
  );

  // Copy pages in order
  for (const editorPage of pages) {
    const srcDoc = loadedSources[editorPage.sourceIndex];
    if (!srcDoc) continue;

    const [copiedPage] = await outputDoc.copyPages(srcDoc, [editorPage.pageIndex]);
    copiedPage.setRotation(degrees(editorPage.rotation));
    outputDoc.addPage(copiedPage);
  }

  // Embed Fabric overlays as PNG images
  for (let i = 0; i < pages.length; i++) {
    const editorPage = pages[i];
    if (!editorPage.fabricJson) continue;

    const fabricData = JSON.parse(editorPage.fabricJson);
    if (!fabricData.objects || fabricData.objects.length === 0) continue;

    const pngDataUrl = await renderFabricToImage(editorPage);
    if (!pngDataUrl) continue;

    const pngBytes = dataUrlToUint8Array(pngDataUrl);
    const pngImage = await outputDoc.embedPng(pngBytes);

    const page = outputDoc.getPage(i);
    const { width, height } = page.getSize();

    page.drawImage(pngImage, { x: 0, y: 0, width, height });
  }

  // Fill form fields
  try {
    const form = outputDoc.getForm();
    for (const editorPage of pages) {
      for (const [fieldName, value] of Object.entries(editorPage.formFieldValues)) {
        try {
          const field = form.getField(fieldName);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const f = field as any;
          const typeName = field.constructor.name;
          if (typeName === 'PDFTextField') {
            f.setText(value);
          } else if (typeName === 'PDFCheckBox') {
            if (value === 'true') f.check();
            else f.uncheck();
          } else if (typeName === 'PDFDropdown' || typeName === 'PDFRadioGroup') {
            f.select(value);
          }
        } catch {
          // Field may not exist in the output document
        }
      }
    }
  } catch {
    // PDF has no form
  }

  const finalBytes = await outputDoc.save();
  const blob = new Blob([finalBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Open PDF in a new tab and trigger the Print dialog (default: Save as PDF)
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.document.title = outputFileName;
    printWindow.addEventListener('afterprint', () => {
      URL.revokeObjectURL(url);
    });
    printWindow.addEventListener('load', () => {
      setTimeout(() => printWindow.print(), 500);
    });
  }
}

async function renderFabricToImage(editorPage: EditorPage): Promise<string | null> {
  if (!editorPage.fabricJson) return null;

  const { StaticCanvas } = await import('fabric');
  const fabricData = JSON.parse(editorPage.fabricJson);

  const effectiveWidth = editorPage.rotation % 180 === 0 ? editorPage.width : editorPage.height;
  const effectiveHeight = editorPage.rotation % 180 === 0 ? editorPage.height : editorPage.width;

  const scale = 2; // 2x for quality
  const canvas = new StaticCanvas(undefined, {
    width: effectiveWidth * scale,
    height: effectiveHeight * scale,
  });

  await canvas.loadFromJSON({ ...fabricData, background: 'transparent' });
  canvas.setDimensions({ width: effectiveWidth * scale, height: effectiveHeight * scale });
  canvas.setZoom(scale);
  canvas.renderAll();

  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
  canvas.dispose();
  return dataUrl;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
