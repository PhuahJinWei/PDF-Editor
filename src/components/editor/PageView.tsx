'use client';

import { useRef, useEffect } from 'react';
import { usePdfStore } from '@/stores/pdfStore';
import { renderPageToCanvas, renderPageToDataUrl } from '@/lib/pdf/pdfPageRenderer';
import { FabricCanvas } from './FabricCanvas';
import type { EditorPage } from '@/types/editor';

interface PageViewProps {
  page: EditorPage;
  index: number;
  zoom: number;
}

export function PageView({ page, index, zoom }: PageViewProps) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const sources = usePdfStore((s) => s.sources);
  const updateThumbnail = usePdfStore((s) => s.updateThumbnail);

  const source = sources[page.sourceIndex];

  const scale = 1.5 * zoom;
  const isRotated = page.rotation % 180 !== 0;
  const displayWidth = (isRotated ? page.height : page.width) * scale;
  const displayHeight = (isRotated ? page.width : page.height) * scale;

  // Render PDF page to canvas
  useEffect(() => {
    if (!pdfCanvasRef.current || !source) return;

    let cancelled = false;

    (async () => {
      try {
        await renderPageToCanvas(
          source.bytes,
          page.pageIndex,
          pdfCanvasRef.current!,
          1.5 * zoom,
          page.rotation
        );

        if (!cancelled) {
          // Generate thumbnail after successful render
          const thumbUrl = await renderPageToDataUrl(
            source.bytes,
            page.pageIndex,
            0.2,
            page.rotation
          );
          if (!cancelled) {
            // Pause temporal tracking so thumbnail updates don't create undo entries
            const temporal = usePdfStore.temporal.getState();
            temporal.pause();
            updateThumbnail(page.id, thumbUrl);
            temporal.resume();
          }
        }
      } catch {
        // Render was cancelled or failed
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, page.pageIndex, page.rotation, zoom, page.id, updateThumbnail]);

  // Regenerate thumbnail if it was lost (e.g., after undo)
  useEffect(() => {
    if (page.thumbnailDataUrl !== null || !source) return;

    let cancelled = false;

    (async () => {
      try {
        const thumbUrl = await renderPageToDataUrl(
          source.bytes,
          page.pageIndex,
          0.2,
          page.rotation
        );
        if (!cancelled) {
          const temporal = usePdfStore.temporal.getState();
          temporal.pause();
          updateThumbnail(page.id, thumbUrl);
          temporal.resume();
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page.thumbnailDataUrl, page.id, page.pageIndex, page.rotation, source, updateThumbnail]);

  // Regenerate composite thumbnail (PDF + Fabric annotations) when annotations change
  useEffect(() => {
    if (!source || page.fabricJson === null) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const thumbScale = 0.2;
        const isRot = page.rotation % 180 !== 0;
        const thumbW = Math.round((isRot ? page.height : page.width) * thumbScale);
        const thumbH = Math.round((isRot ? page.width : page.height) * thumbScale);

        // Render PDF background at thumbnail scale
        const pdfUrl = await renderPageToDataUrl(
          source.bytes,
          page.pageIndex,
          thumbScale,
          page.rotation,
        );
        if (cancelled) return;

        // Load PDF image
        const pdfImg = new Image();
        pdfImg.src = pdfUrl;
        await new Promise<void>((res, rej) => {
          pdfImg.onload = () => res();
          pdfImg.onerror = rej;
        });
        if (cancelled) return;

        // Render Fabric annotations at thumbnail scale
        const { StaticCanvas } = await import('fabric');
        const sc = new StaticCanvas(null as unknown as HTMLCanvasElement, {
          width: thumbW,
          height: thumbH,
        });
        await sc.loadFromJSON(JSON.parse(page.fabricJson!));
        // Scene coordinates are at 1.5× PDF dimensions; scale down to thumbnail
        sc.setZoom(thumbScale / 1.5);
        sc.setDimensions({ width: thumbW, height: thumbH });
        sc.renderAll();

        // Composite both layers onto an offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = thumbW;
        offscreen.height = thumbH;
        const ctx = offscreen.getContext('2d')!;
        ctx.drawImage(pdfImg, 0, 0, thumbW, thumbH);
        ctx.drawImage(sc.getElement(), 0, 0);
        sc.dispose();

        if (cancelled) return;

        const compositeUrl = offscreen.toDataURL('image/png');
        const temporal = usePdfStore.temporal.getState();
        temporal.pause();
        updateThumbnail(page.id, compositeUrl);
        temporal.resume();
      } catch {
        // ignore
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page.fabricJson, source, page.pageIndex, page.rotation, page.width, page.height, page.id, updateThumbnail]);

  return (
    <div
      className="relative shadow-lg"
      style={{ width: displayWidth, height: displayHeight }}
      data-page-index={index}
    >
      {/* PDF background canvas */}
      <canvas
        ref={pdfCanvasRef}
        className="absolute left-0 top-0"
        style={{ width: displayWidth, height: displayHeight }}
      />

      {/* Fabric.js editing overlay */}
      <FabricCanvas
        pageId={page.id}
        width={displayWidth}
        height={displayHeight}
        zoom={zoom}
        fabricJson={page.fabricJson}
      />
    </div>
  );
}
