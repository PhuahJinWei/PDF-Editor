import { loadPdfDocument } from '@/lib/pdf/pdfLoader';
import { usePdfStore } from '@/stores/pdfStore';
import { useEditorStore } from '@/stores/editorStore';

export function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(buffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Open a PDF file: read bytes, parse pages, load into the store, reset active
 * page index, and clear undo history.  This is the single shared implementation
 * used by DropZone, Header upload, and AppShell drag-drop.
 */
export async function openPdfFile(file: File): Promise<void> {
  if (file.type !== 'application/pdf') return;
  const bytes = await readFileAsArrayBuffer(file);
  const { pages } = await loadPdfDocument(bytes, 0);
  usePdfStore.getState().loadPdf(bytes, file.name, pages);
  useEditorStore.getState().setActivePageIndex(0);
  usePdfStore.temporal.getState().clear();
}
