'use client';

import { useRef } from 'react';
import {
  MousePointer2,
  Pen,
  Highlighter,
  Eraser,
  Type,
  Image,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { usePdfStore } from '@/stores/pdfStore';
import type { Tool } from '@/types/editor';
import { ToolSettings } from './ToolSettings';

const tools: { tool: Tool; icon: React.ElementType; label: string }[] = [
  { tool: 'select', icon: MousePointer2, label: 'Select' },
  { tool: 'pen', icon: Pen, label: 'Pen' },
  { tool: 'highlighter', icon: Highlighter, label: 'Highlight' },
  { tool: 'eraser', icon: Eraser, label: 'Eraser' },
  { tool: 'text', icon: Type, label: 'Text' },
  { tool: 'image', icon: Image, label: 'Image' },
];

export function Toolbar() {
  const { activeTool, setActiveTool } = useEditorStore();
  const { undo, redo } = usePdfStore.temporal.getState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      useEditorStore.getState().setPendingImageDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 border-b border-border bg-surface px-3 py-1.5">
      {/* Hidden file input for image import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImageFile}
      />

      {/* Tool buttons */}
      <div className="flex items-center gap-0.5">
        {tools.map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            onClick={() => {
              if (tool === 'image') {
                fileInputRef.current?.click();
                return;
              }
              setActiveTool(tool);
            }}
            title={label}
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              activeTool === tool
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="mx-1.5 h-6 w-px bg-border" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => undo()}
          title="Undo (Ctrl+Z)"
          className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => redo()}
          title="Redo (Ctrl+Y)"
          className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-1.5 h-6 w-px bg-border" />

      {/* Tool Settings */}
      <ToolSettings />
    </div>
  );
}
