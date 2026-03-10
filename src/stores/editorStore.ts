import { create } from 'zustand';
import type { Tool, ToolSettings } from '@/types/editor';

interface EditorState {
  activeTool: Tool;
  toolSettings: ToolSettings;
  zoom: number;
  activePageIndex: number;
  pendingImageDataUrl: string | null;
  isTextSelected: boolean;
  clipboardObjects: object[] | null;

  setActiveTool: (tool: Tool) => void;
  updateToolSettings: (settings: Partial<ToolSettings>) => void;
  setZoom: (zoom: number) => void;
  setActivePageIndex: (index: number) => void;
  setPendingImageDataUrl: (url: string | null) => void;
  setIsTextSelected: (value: boolean) => void;
  setClipboardObjects: (objects: object[] | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  toolSettings: {
    strokeColor: '#000000',
    strokeWidth: 2,
    fontSize: 16,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    underline: false,
    highlightColor: '#FFFF00',
  },
  zoom: 1,
  activePageIndex: 0,
  pendingImageDataUrl: null,
  isTextSelected: false,
  clipboardObjects: null,

  setActiveTool: (tool) => set({ activeTool: tool }),
  updateToolSettings: (settings) =>
    set((state) => ({
      toolSettings: { ...state.toolSettings, ...settings },
    })),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2, zoom)) }),
  setActivePageIndex: (index) => set({ activePageIndex: index }),
  setPendingImageDataUrl: (url) => set({ pendingImageDataUrl: url }),
  setIsTextSelected: (value) => set({ isTextSelected: value }),
  setClipboardObjects: (objects) => set({ clipboardObjects: objects }),
}));
