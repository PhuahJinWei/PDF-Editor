'use client';

// Polyfill for Map.prototype.getOrInsertComputed — used by pdfjs-dist v5 but not
// yet available in all browsers. Must run before pdfjs is imported.
if (typeof Map !== 'undefined' && !('getOrInsertComputed' in Map.prototype)) {
  (Map.prototype as unknown as Record<string, unknown>).getOrInsertComputed = function <K, V>(
    this: Map<K, V>,
    key: K,
    callbackFn: (key: K) => V
  ): V {
    if (!this.has(key)) {
      this.set(key, callbackFn(key));
    }
    return this.get(key) as V;
  };
}

import * as pdfjsLib from 'pdfjs-dist';
import type { RenderTask } from 'pdfjs-dist';

let workerConfigured = false;

function ensureWorker() {
  if (!workerConfigured && typeof window !== 'undefined') {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
    workerConfigured = true;
  }
}

const documentCache = new Map<string, pdfjsLib.PDFDocumentProxy>();

function getCacheKey(bytes: Uint8Array): string {
  const len = bytes.length;
  const head = bytes.slice(0, 16);
  const tail = bytes.slice(Math.max(0, len - 16));
  return `${len}-${Array.from(head).join(',')}-${Array.from(tail).join(',')}`;
}

async function getPdfDocument(bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  ensureWorker();
  const key = getCacheKey(bytes);
  const cached = documentCache.get(key);
  if (cached) return cached;

  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  documentCache.set(key, doc);
  return doc;
}

// Track active render tasks per canvas to cancel previous renders
const activeRenders = new WeakMap<HTMLCanvasElement, RenderTask>();

export async function renderPageToCanvas(
  bytes: Uint8Array,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5,
  rotation: number = 0
): Promise<{ width: number; height: number }> {
  // Cancel any existing render on this canvas and wait for it to fully stop
  const existing = activeRenders.get(canvas);
  if (existing) {
    existing.cancel();
    try { await existing.promise; } catch { /* cancellation */ }
    activeRenders.delete(canvas);
  }

  const doc = await getPdfDocument(bytes);
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderTask = page.render({ canvas, viewport });
  activeRenders.set(canvas, renderTask);

  try {
    await renderTask.promise;
  } catch (err) {
    // Ignore cancellation errors
    if (err instanceof Error && err.message.includes('Rendering cancelled')) {
      return { width: viewport.width, height: viewport.height };
    }
    throw err;
  } finally {
    activeRenders.delete(canvas);
  }

  return { width: viewport.width, height: viewport.height };
}

export async function renderPageToDataUrl(
  bytes: Uint8Array,
  pageIndex: number,
  scale: number = 0.3,
  rotation: number = 0
): Promise<string> {
  const doc = await getPdfDocument(bytes);
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  return canvas.toDataURL('image/png');
}
