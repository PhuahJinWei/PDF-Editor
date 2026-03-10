'use client';

import { useRef, useEffect } from 'react';
import { usePdfStore } from '@/stores/pdfStore';
import { useEditorStore } from '@/stores/editorStore';
import { PageView } from './PageView';
import { ZoomControls } from './ZoomControls';

export function EditorCanvas() {
  const pages = usePdfStore((s) => s.pages);
  const zoom = useEditorStore((s) => s.zoom);
  const setActivePageIndex = useEditorStore((s) => s.setActivePageIndex);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track which page is most visible and update activePageIndex
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const ratioMap = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = Number(
            (entry.target as HTMLElement).dataset.pageIndex
          );
          if (!isNaN(pageIndex)) {
            ratioMap.set(pageIndex, entry.intersectionRatio);
          }
        });

        // Find the page with the highest visibility ratio
        let bestIndex = 0;
        let bestRatio = 0;
        ratioMap.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        });

        if (bestRatio > 0) {
          setActivePageIndex(bestIndex);
        }
      },
      {
        root: container,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );

    // Observe all page elements
    const pageElements = container.querySelectorAll('[data-page-index]');
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pages.length, setActivePageIndex]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollContainerRef} className="h-full overflow-auto bg-background p-6">
        <div className="flex flex-col items-center gap-6">
          {pages.map((page, index) => (
            <PageView key={page.id} page={page} index={index} zoom={zoom} />
          ))}
        </div>
      </div>
      <ZoomControls />
    </div>
  );
}
