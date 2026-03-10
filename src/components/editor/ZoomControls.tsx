'use client';

import { Minus, Plus } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-md">
      <button
        onClick={() => setZoom(zoom - 0.1)}
        title="Zoom Out"
        className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <input
        type="range"
        min={50}
        max={200}
        step={1}
        value={Math.round(zoom * 100)}
        onChange={(e) => setZoom(Number(e.target.value) / 100)}
        className="h-1.5 w-28 cursor-pointer accent-primary"
        title={`Zoom: ${Math.round(zoom * 100)}%`}
      />

      <button
        onClick={() => setZoom(zoom + 0.1)}
        title="Zoom In"
        className="flex h-7 w-7 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <span className="min-w-[3rem] text-center text-xs font-medium text-muted">
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
