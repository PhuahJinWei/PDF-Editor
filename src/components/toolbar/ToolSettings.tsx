'use client';

import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Calibri',
  'Trebuchet MS',
  'Comic Sans MS',
];

export function ToolSettings() {
  const { activeTool, toolSettings, updateToolSettings, isTextSelected } =
    useEditorStore();

  const showPenSettings = activeTool === 'pen';
  const showHighlightColor = activeTool === 'highlighter';
  const showTextSettings = activeTool === 'text' || isTextSelected;

  if (!showPenSettings && !showHighlightColor && !showTextSettings) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Pen color */}
      {showPenSettings && (
        <>
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Color</span>
            <input
              type="color"
              value={toolSettings.strokeColor}
              onChange={(e) => updateToolSettings({ strokeColor: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded border border-border"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Width</span>
            <input
              type="range"
              min={1}
              max={20}
              value={toolSettings.strokeWidth}
              onChange={(e) =>
                updateToolSettings({ strokeWidth: Number(e.target.value) })
              }
              className="w-20"
            />
            <span className="w-4 text-muted">{toolSettings.strokeWidth}</span>
          </label>
        </>
      )}

      {/* Highlight color */}
      {showHighlightColor && (
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Color</span>
          <input
            type="color"
            value={toolSettings.highlightColor}
            onChange={(e) =>
              updateToolSettings({ highlightColor: e.target.value })
            }
            className="h-6 w-6 cursor-pointer rounded border border-border"
          />
        </label>
      )}

      {/* Text formatting */}
      {showTextSettings && (
        <>
          {/* Font family */}
          <select
            value={toolSettings.fontFamily}
            onChange={(e) =>
              updateToolSettings({ fontFamily: e.target.value })
            }
            className="h-7 rounded border border-border bg-white px-1.5 text-xs"
            title="Font"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Font size */}
          <select
            value={toolSettings.fontSize}
            onChange={(e) =>
              updateToolSettings({ fontSize: Number(e.target.value) })
            }
            className="h-7 w-16 rounded border border-border bg-white px-1 text-xs"
            title="Font size"
          >
            {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72].map(
              (size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              )
            )}
          </select>

          {/* Text color */}
          <input
            type="color"
            value={toolSettings.strokeColor}
            onChange={(e) =>
              updateToolSettings({ strokeColor: e.target.value })
            }
            className="h-6 w-6 cursor-pointer rounded border border-border"
            title="Text color"
          />

          {/* Separator */}
          <div className="mx-0.5 h-5 w-px bg-border" />

          {/* Bold / Italic / Underline */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() =>
                updateToolSettings({
                  fontWeight:
                    toolSettings.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              title="Bold"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.fontWeight === 'bold'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() =>
                updateToolSettings({
                  fontStyle:
                    toolSettings.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              title="Italic"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.fontStyle === 'italic'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() =>
                updateToolSettings({ underline: !toolSettings.underline })
              }
              title="Underline"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.underline
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Separator */}
          <div className="mx-0.5 h-5 w-px bg-border" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => updateToolSettings({ textAlign: 'left' })}
              title="Align Left"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.textAlign === 'left'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => updateToolSettings({ textAlign: 'center' })}
              title="Align Center"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.textAlign === 'center'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => updateToolSettings({ textAlign: 'right' })}
              title="Align Right"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                toolSettings.textAlign === 'right'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
