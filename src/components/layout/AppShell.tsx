'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePdfStore } from '@/stores/pdfStore';
import { useEditorStore } from '@/stores/editorStore';
import { openPdfFile } from '@/lib/utils/fileHelpers';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { DropZone } from '@/components/ui/DropZone';
import { fabricCanvasRegistry } from '@/components/editor/FabricCanvas';

export function AppShell() {
  const pages = usePdfStore((s) => s.pages);
  const hasDocument = pages.length > 0;
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Shared PDF file handler for drag-drop
  const handlePdfFile = useCallback((file: File) => openPdfFile(file), []);

  // Drag-drop handlers for the entire app window
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only show overlay if dragging files (not internal dnd-kit drags)
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only clear when leaving the root element (not child boundaries)
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const file = e.dataTransfer.files[0];
      if (file) handlePdfFile(file);
    },
    [handlePdfFile],
  );

  // Global keyboard shortcuts (single handler, not per-page)
  useEffect(() => {
    /** Look up the active page's canvas entry from the registry. */
    const getActiveEntry = () => {
      const { activePageIndex } = useEditorStore.getState();
      const { pages: currentPages } = usePdfStore.getState();
      const activePage = currentPages[activePageIndex];
      if (!activePage) return null;
      return fabricCanvasRegistry.get(activePage.id) ?? null;
    };

    /** Returns true if the active object on the canvas is being text-edited. */
    const isEditingText = (canvas: import('fabric').Canvas) => {
      const obj = canvas.getActiveObject();
      return obj && (obj as unknown as { isEditing?: boolean }).isEditing;
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        usePdfStore.temporal.getState().undo();
        return;
      }
      // Redo
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        usePdfStore.temporal.getState().redo();
        return;
      }

      // Copy (Ctrl+C)
      if (e.ctrlKey && e.key === 'c' && !e.shiftKey) {
        const entry = getActiveEntry();
        if (!entry || isEditingText(entry.canvas)) return; // let browser handle text copy
        const selected = entry.canvas.getActiveObjects();
        if (selected.length === 0) return;
        e.preventDefault();
        const serialized = selected.map((obj) => obj.toObject());
        useEditorStore.getState().setClipboardObjects(serialized);
        return;
      }

      // Cut (Ctrl+X)
      if (e.ctrlKey && e.key === 'x' && !e.shiftKey) {
        const entry = getActiveEntry();
        if (!entry || isEditingText(entry.canvas)) return;
        const selected = entry.canvas.getActiveObjects();
        if (selected.length === 0) return;
        e.preventDefault();
        const serialized = selected.map((obj) => obj.toObject());
        useEditorStore.getState().setClipboardObjects(serialized);
        // Remove the objects from the source canvas
        selected.forEach((obj) => entry.canvas.remove(obj));
        entry.canvas.discardActiveObject();
        entry.canvas.renderAll();
        // saveState is triggered by the object:removed event handler in FabricCanvas
        return;
      }

      // Paste (Ctrl+V) — internal clipboard objects
      if (e.ctrlKey && e.key === 'v' && !e.shiftKey) {
        const entry = getActiveEntry();
        if (!entry || isEditingText(entry.canvas)) return;
        const clipboard = useEditorStore.getState().clipboardObjects;
        if (!clipboard || clipboard.length === 0) return; // no internal clipboard → let browser paste event handle images
        e.preventDefault();
        const { util, FabricObject } = await import('fabric');
        const objects = await util.enlivenObjects(clipboard) as InstanceType<typeof FabricObject>[];
        objects.forEach((obj) => {
          // Offset slightly so the paste doesn't stack exactly on the original
          obj.set({ left: (obj.left ?? 0) + 10, top: (obj.top ?? 0) + 10 });
          entry.canvas.add(obj);
        });
        entry.canvas.requestRenderAll();
        entry.saveState();
        return;
      }

      // Delete/Backspace — remove selected objects on the active page's canvas
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const entry = getActiveEntry();
        if (!entry || isEditingText(entry.canvas)) return;

        const selected = entry.canvas.getActiveObjects();
        if (selected.length > 0) {
          selected.forEach((obj) => entry.canvas.remove(obj));
          entry.canvas.discardActiveObject();
          entry.canvas.renderAll();
          // saveState is triggered by the object:removed event handler in FabricCanvas
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Header />
      {hasDocument && <Toolbar />}
      <div className="flex flex-1 overflow-hidden">
        {hasDocument ? (
          <>
            <Sidebar />
            <EditorCanvas />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <DropZone />
          </div>
        )}
      </div>

      {/* Full-screen drag overlay */}
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-primary bg-white/90 px-12 py-8 shadow-lg">
            <p className="text-lg font-medium text-primary">Drop PDF to open</p>
          </div>
        </div>
      )}
    </div>
  );
}
