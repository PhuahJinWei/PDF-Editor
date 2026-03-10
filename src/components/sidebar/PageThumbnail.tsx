'use client';

import { useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Trash2 } from 'lucide-react';
import { usePdfStore } from '@/stores/pdfStore';
import type { EditorPage } from '@/types/editor';

interface PageThumbnailProps {
  page: EditorPage;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

export function PageThumbnail({ page, index, isActive, onClick }: PageThumbnailProps) {
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const pages = usePdfStore((s) => s.pages);

  // Cache last known thumbnail to prevent "Loading..." flash during undo
  const lastThumbnailRef = useRef<string | null>(page.thumbnailDataUrl);
  if (page.thumbnailDataUrl) {
    lastThumbnailRef.current = page.thumbnailDataUrl;
  }
  const displayThumbnail = page.thumbnailDataUrl ?? lastThumbnailRef.current;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-thumbnail-index={index}
      className={`group relative cursor-pointer rounded border-2 p-1 transition-colors ${
        isActive ? 'border-primary' : 'border-transparent hover:border-gray-300'
      }`}
    >
      {/* Thumbnail image */}
      <div className="flex items-center justify-center overflow-hidden rounded bg-white">
        {displayThumbnail ? (
          <img
            src={displayThumbnail}
            alt={`Page ${index + 1}`}
            className="max-h-[180px] w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-[140px] w-full items-center justify-center text-xs text-muted">
            Loading...
          </div>
        )}
      </div>

      {/* Page number */}
      <div className="mt-1 text-center text-[10px] text-muted">
        Page {index + 1}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            rotatePage(page.id, 90);
          }}
          title="Rotate 90°"
          className="flex h-5 w-5 items-center justify-center rounded bg-white/90 text-gray-600 shadow-sm hover:bg-gray-100"
        >
          <RotateCw className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const isLastPage = pages.length === 1;
            if (confirm(isLastPage ? 'Delete this page and close the document?' : 'Delete this page?')) {
              deletePage(page.id);
              if (isLastPage) {
                usePdfStore.temporal.getState().clear();
              }
            }
          }}
          title="Delete page"
          className="flex h-5 w-5 items-center justify-center rounded bg-white/90 text-danger shadow-sm hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
