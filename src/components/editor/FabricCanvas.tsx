'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { usePdfStore } from '@/stores/pdfStore';
import { configureTool } from '@/lib/fabric/tools';
import { attemptCrossPageTransfer } from '@/lib/fabric/crossPageTransfer';
import type { Canvas, FabricObject, TPointerEventInfo, TPointerEvent } from 'fabric';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Properties that exist on Fabric text objects but not the base FabricObject type. */
type TextProps = {
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  underline?: boolean;
  isEditing?: boolean;
  enterEditing?: () => void;
  exitEditing?: () => void;
  findControl?: (pointer: { x: number; y: number }) => unknown;
};

/** Check whether a Fabric object is a text type (IText, Text, or Textbox). */
function isTextObject(obj: FabricObject): obj is FabricObject & TextProps {
  return obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
}

/** Centre and scale an image to fit within the canvas scene at ≤ 50 % of the
 *  smaller scene dimension. */
function fitImageToScene(
  img: FabricObject,
  sceneWidth: number,
  sceneHeight: number,
) {
  const imgW = img.width || 100;
  const imgH = img.height || 100;
  const maxDim = Math.min(sceneWidth, sceneHeight) * 0.5;
  const scale = Math.min(maxDim / imgW, maxDim / imgH, 1);
  img.set({
    left: sceneWidth / 2 - (imgW * scale) / 2,
    top: sceneHeight / 2 - (imgH * scale) / 2,
    scaleX: scale,
    scaleY: scale,
  });
}

/** Get zoom-aware scene coordinates from a pointer event. */
function getScenePoint(canvas: Canvas, e: TPointerEvent) {
  return (canvas as Canvas & {
    getScenePoint(e: TPointerEvent): { x: number; y: number };
  }).getScenePoint(e);
}

/** Get viewport coordinates from a pointer event. */
function getViewportPoint(canvas: Canvas, e: TPointerEvent) {
  return (canvas as Canvas & {
    getViewportPoint(e: TPointerEvent): { x: number; y: number };
  }).getViewportPoint(e);
}

// ---------------------------------------------------------------------------
// Canvas registry — allows the global keyboard handler to access any page's canvas
// ---------------------------------------------------------------------------

export interface CanvasEntry {
  canvas: Canvas;
  saveState: () => void;
}

export const fabricCanvasRegistry = new Map<string, CanvasEntry>();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FabricCanvasProps {
  pageId: string;
  width: number;
  height: number;
  zoom: number;
  fabricJson: string | null;
}

export function FabricCanvas({ pageId, width, height, zoom, fabricJson }: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const isInitializedRef = useRef(false);
  const savingRef = useRef(false);
  const loadingRef = useRef(false);
  const lastSavedJsonRef = useRef<string | null>(fabricJson);
  const transferInProgressRef = useRef(false);
  const shiftDrawStartRef = useRef<{ x: number; y: number } | null>(null);
  const shiftDrawEndRef = useRef<{ x: number; y: number } | null>(null);

  const activeTool = useEditorStore((s) => s.activeTool);
  const toolSettings = useEditorStore((s) => s.toolSettings);
  const pendingImageDataUrl = useEditorStore((s) => s.pendingImageDataUrl);
  const updatePageFabricState = usePdfStore((s) => s.updatePageFabricState);

  // ---- Persist Fabric state to the store ----

  const saveState = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || savingRef.current || loadingRef.current) return;
    savingRef.current = true;
    const json = JSON.stringify(canvas.toJSON());
    lastSavedJsonRef.current = json;
    updatePageFabricState(pageId, json);
    savingRef.current = false;
  }, [pageId, updatePageFabricState]);

  // ---- Initialise Fabric canvas (runs once on mount) ----

  useEffect(() => {
    if (!canvasRef.current || isInitializedRef.current) return;

    let disposed = false;

    (async () => {
      const fabric = await import('fabric');
      if (disposed) return;

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width,
        height,
        backgroundColor: 'transparent',
        selection: true,
        uniformScaling: false,
      });

      canvas.setZoom(zoom);

      // Selection styling: thicker border + circle handles
      const parentCtor = Object.getPrototypeOf(fabric.Rect.prototype).constructor as
        { ownDefaults?: Record<string, unknown>; prototype?: { controls?: Record<string, Record<string, unknown>> } };
      if (parentCtor.ownDefaults) {
        Object.assign(parentCtor.ownDefaults, {
          borderColor: '#4285f4',
          borderScaleFactor: 2.5,
          cornerColor: '#4285f4',
          cornerStrokeColor: '#ffffff',
          cornerStyle: 'circle',
          cornerSize: 10,
          transparentCorners: false,
          padding: 10,
        });
      }

      // Customise selection controls (shared by all object types)
      const controls = parentCtor.prototype?.controls;
      if (controls) {
        // Shorten the line between the rotate handle and the object
        if (controls.mtr) {
          controls.mtr.offsetY = -20;
          // Show grab cursor when hovering over the rotate handle
          controls.mtr.cursorStyleHandler = () => 'grab';
          controls.mtr.cursorStyle = 'grab';
        }

        // Corner controls: free resize by default, Shift = locked aspect ratio.
        // Fabric's default `scalingEqually` always locks aspect ratio; we replace
        // it with independent X+Y scaling, falling back to uniform when Shift is held.
        const { scalingEqually, scalingX, scalingY, scaleCursorStyleHandler } = fabric.controlsUtils;
        const corners = ['tl', 'tr', 'bl', 'br'];
        for (const key of corners) {
          if (controls[key]) {
            controls[key].actionHandler = (
              eventData: MouseEvent,
              transform: Parameters<typeof scalingEqually>[1],
              x: number,
              y: number,
            ) => {
              if (eventData.shiftKey) {
                return scalingEqually(eventData, transform, x, y);
              }
              scalingX(eventData, transform, x, y);
              return scalingY(eventData, transform, x, y);
            };
          }
        }

        // Ensure corner / edge controls show correct resize cursors
        const fallbackCursors: Record<string, string> = {
          tl: 'nw-resize', tr: 'ne-resize',
          bl: 'sw-resize', br: 'se-resize',
          mt: 'n-resize',  mb: 's-resize',
          ml: 'w-resize',  mr: 'e-resize',
        };
        for (const [key, cursor] of Object.entries(fallbackCursors)) {
          if (controls[key]) {
            controls[key].cursorStyle = cursor;
            if (scaleCursorStyleHandler) {
              controls[key].cursorStyleHandler = scaleCursorStyleHandler;
            }
          }
        }
      }

      fabricRef.current = canvas;
      isInitializedRef.current = true;
      fabricCanvasRegistry.set(pageId, { canvas, saveState });

      // Position Fabric's wrapper div absolutely to overlay on the PDF canvas
      const wrapper = canvasRef.current?.parentElement;
      if (wrapper?.classList.contains('canvas-container')) {
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
      }

      // Ensure a PencilBrush exists (Fabric v7 may not create one by default)
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      }

      // Load existing state if any
      if (fabricJson) {
        loadingRef.current = true;
        try {
          await canvas.loadFromJSON(JSON.parse(fabricJson));
          canvas.setZoom(zoom);
          canvas.renderAll();
        } catch (e) {
          console.warn('Failed to load fabric state:', e);
        } finally {
          loadingRef.current = false;
        }
      }

      // ---- Canvas event handlers ----

      // Shift+draw: track start/end for straight-line drawing
      canvas.on('mouse:down', (opt: TPointerEventInfo<TPointerEvent>) => {
        if (canvas.isDrawingMode && (opt.e as MouseEvent).shiftKey) {
          const point = getScenePoint(canvas, opt.e);
          shiftDrawStartRef.current = point;
          shiftDrawEndRef.current = point;
        }
      });
      canvas.on('mouse:move', (opt: TPointerEventInfo<TPointerEvent>) => {
        if (shiftDrawStartRef.current) {
          shiftDrawEndRef.current = getScenePoint(canvas, opt.e);
        }
      });

      canvas.on('path:created', async (opt) => {
        if (shiftDrawStartRef.current && shiftDrawEndRef.current) {
          // Replace the freehand path with a straight line
          const pathObj = (opt as unknown as { path: FabricObject }).path;
          if (pathObj) canvas.remove(pathObj);

          const start = shiftDrawStartRef.current;
          const end = shiftDrawEndRef.current;
          shiftDrawStartRef.current = null;
          shiftDrawEndRef.current = null;

          const fabricMod = await import('fabric');
          const line = new fabricMod.Line(
            [start.x, start.y, end.x, end.y],
            {
              stroke: canvas.freeDrawingBrush?.color ?? '#000000',
              strokeWidth: canvas.freeDrawingBrush?.width ?? 2,
              strokeLineCap: 'round',
            },
          );
          canvas.add(line);
          saveState();
        } else {
          saveState();
        }
      });
      canvas.on('object:removed', () => {
        if (!transferInProgressRef.current) saveState();
      });

      // Convert text scale → width on resize (keeps font size unchanged)
      canvas.on('object:modified', (opt) => {
        // Skip if a cross-page transfer is in progress (prevents re-entry
        // when discardActiveObject fires object:modified from setTimeout)
        if (transferInProgressRef.current) return;

        const target = opt.target;
        if (target && isTextObject(target)) {
          const sx = target.scaleX ?? 1;
          const sy = target.scaleY ?? 1;
          if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
            target.set({ width: target.width * sx, scaleX: 1, scaleY: 1 });
            target.setCoords();
            canvas.requestRenderAll();
          }
        }

        // Cross-page object transfer: if the object was dragged beyond the
        // canvas bounds, hand it off to the adjacent page's canvas.
        if (target) {
          const transferred = attemptCrossPageTransfer(
            canvas, target, pageId, saveState,
            transferInProgressRef, fabricCanvasRegistry,
          );
          if (transferred) return; // skip normal saveState()
        }

        saveState();
      });

      // Remove empty text when editing exits; always save final content
      canvas.on('text:editing:exited', (opt: { target?: FabricObject }) => {
        const target = opt?.target;
        if (target && isTextObject(target) && (!target.text || target.text.trim() === '')) {
          canvas.remove(target);
          canvas.requestRenderAll();
        }
        saveState();
      });

      // Force selection controls to stay visible during text editing.
      // Fabric hides controls when isEditing = true; we redraw after each render.
      canvas.on('after:render', () => {
        const activeObj = canvas.getActiveObject();
        if (!activeObj || !isTextObject(activeObj) || !activeObj.isEditing) return;
        activeObj.drawControls(canvas.getContext());
      });

      // Allow resizing while editing text: if the click lands on a control
      // handle, exit editing first so Fabric's resize logic kicks in.
      canvas.on('mouse:down:before', ({ e }: { e: TPointerEvent }) => {
        const activeObj = canvas.getActiveObject();
        if (!activeObj || !isTextObject(activeObj) || !activeObj.isEditing) return;
        activeObj.setCoords();
        const pointer = getViewportPoint(canvas, e);
        if (activeObj.findControl?.(pointer)) {
          activeObj.exitEditing?.();
          canvas.requestRenderAll();
        }
      });

      // Sync text object formatting to the toolbar when selected
      const syncTextSelection = () => {
        const activeObj = canvas.getActiveObject();
        if (activeObj && isTextObject(activeObj)) {
          useEditorStore.getState().setIsTextSelected(true);
          useEditorStore.getState().updateToolSettings({
            fontSize: Math.round(activeObj.fontSize ?? 16),
            fontFamily: activeObj.fontFamily ?? 'Arial',
            strokeColor: (activeObj.fill as string) ?? '#000000',
            fontWeight: activeObj.fontWeight === 'bold' ? 'bold' : 'normal',
            fontStyle: activeObj.fontStyle === 'italic' ? 'italic' : 'normal',
            textAlign: (['left', 'center', 'right'] as const).includes(
              activeObj.textAlign as 'left' | 'center' | 'right',
            )
              ? (activeObj.textAlign as 'left' | 'center' | 'right')
              : 'left',
            underline: !!activeObj.underline,
          });
        } else {
          useEditorStore.getState().setIsTextSelected(false);
        }
      };
      canvas.on('selection:created', syncTextSelection);
      canvas.on('selection:updated', syncTextSelection);
      canvas.on('selection:cleared', syncTextSelection);

      // Configure initial tool
      configureTool(canvas, activeTool, toolSettings);
    })();

    return () => {
      disposed = true;
      fabricCanvasRegistry.delete(pageId);
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
        isInitializedRef.current = false;
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Sync canvas when fabricJson changes externally (undo/redo) ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || fabricJson === lastSavedJsonRef.current) return;

    lastSavedJsonRef.current = fabricJson;

    (async () => {
      loadingRef.current = true;
      try {
        if (fabricJson) {
          await canvas.loadFromJSON(JSON.parse(fabricJson));
        } else {
          canvas.clear();
          canvas.backgroundColor = 'transparent';
        }
        canvas.setZoom(zoom);
        canvas.renderAll();
      } catch (e) {
        console.warn('Failed to reload fabric state:', e);
      } finally {
        loadingRef.current = false;
      }
      // Reconfigure tool after reload (loadFromJSON resets canvas state)
      configureTool(canvas, activeTool, toolSettings);
    })();
  }, [fabricJson, activeTool, toolSettings, zoom]);

  // ---- Update canvas dimensions and zoom ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width, height });
    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [width, height, zoom]);

  // ---- Reconfigure tool when it changes ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    void configureTool(canvas, activeTool, toolSettings).then(() => {
      canvas.requestRenderAll();
    });
  }, [activeTool, toolSettings]);

  // ---- Apply formatting changes to the active text object ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || !isTextObject(activeObj)) return;

    activeObj.set({
      fontSize: toolSettings.fontSize,
      fontFamily: toolSettings.fontFamily,
      fill: toolSettings.strokeColor,
      fontWeight: toolSettings.fontWeight,
      fontStyle: toolSettings.fontStyle,
      textAlign: toolSettings.textAlign,
      underline: toolSettings.underline,
    } as Partial<FabricObject>);
    canvas.requestRenderAll();
    saveState();
  }, [
    toolSettings.fontSize,
    toolSettings.fontFamily,
    toolSettings.strokeColor,
    toolSettings.fontWeight,
    toolSettings.fontStyle,
    toolSettings.textAlign,
    toolSettings.underline,
    saveState,
  ]);

  // ---- Handle text tool clicks ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleClick = async (opt: TPointerEventInfo<TPointerEvent>) => {
      if (activeTool !== 'text') return;
      const pointer = getScenePoint(canvas, opt.e);
      const fabric = await import('fabric');
      const text = new fabric.Textbox('', {
        left: pointer.x,
        top: pointer.y,
        width: 200,
        fontSize: toolSettings.fontSize,
        fill: toolSettings.strokeColor,
        fontFamily: toolSettings.fontFamily,
        fontWeight: toolSettings.fontWeight,
        fontStyle: toolSettings.fontStyle,
        textAlign: toolSettings.textAlign,
        underline: toolSettings.underline,
        padding: 10,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      (text as unknown as { enterEditing: () => void }).enterEditing();
      saveState();
      useEditorStore.getState().setActiveTool('select');
    };

    canvas.on('mouse:down', handleClick);
    return () => {
      canvas.off('mouse:down', handleClick);
    };
  }, [activeTool, toolSettings, saveState]);

  // ---- Handle image addition from toolbar file picker ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !pendingImageDataUrl) return;

    // Only add image to the active page's canvas
    const { activePageIndex } = useEditorStore.getState();
    const { pages } = usePdfStore.getState();
    if (pages[activePageIndex]?.id !== pageId) return;

    // Clear immediately to prevent other canvases from also processing
    const dataUrl = pendingImageDataUrl;
    useEditorStore.getState().setPendingImageDataUrl(null);

    (async () => {
      try {
        const fabric = await import('fabric');
        const img = await fabric.FabricImage.fromURL(dataUrl);
        fitImageToScene(img, width / zoom, height / zoom);
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        saveState();
      } catch (e) {
        console.warn('Failed to add image:', e);
      }
      useEditorStore.getState().setActiveTool('select');
    })();
  }, [pendingImageDataUrl, pageId, width, height, zoom, saveState]);

  // ---- Handle eraser — click / drag to remove annotation objects ----

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== 'eraser') return;

    let isErasing = false;
    let didErase = false;

    const removeTarget = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (opt.target) {
        canvas.remove(opt.target);
        canvas.requestRenderAll();
        didErase = true;
      }
    };

    const onDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      isErasing = true;
      removeTarget(opt);
    };

    const onMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (isErasing) removeTarget(opt);
    };

    const onUp = () => {
      if (isErasing) {
        isErasing = false;
        if (didErase) {
          saveState();
          didErase = false;
        }
      }
    };

    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);
    return () => {
      canvas.off('mouse:down', onDown);
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:up', onUp);
    };
  }, [activeTool, saveState]);

  // ---- Handle Ctrl+V paste image from clipboard ----

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      // Only handle paste on the active page
      const { activePageIndex } = useEditorStore.getState();
      const { pages } = usePdfStore.getState();
      if (pages[activePageIndex]?.id !== pageId) return;

      // Don't intercept paste while editing text — let Fabric handle it
      const activeObj = canvas.getActiveObject();
      if (activeObj && isTextObject(activeObj) && activeObj.isEditing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        try {
          const fabric = await import('fabric');
          const img = await fabric.FabricImage.fromURL(dataUrl);
          fitImageToScene(img, width / zoom, height / zoom);
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.requestRenderAll();
          saveState();
          useEditorStore.getState().setActiveTool('select');
        } catch (err) {
          console.warn('Failed to paste image:', err);
        }
        break; // Only handle the first image
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [pageId, width, height, zoom, saveState]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0"
      style={{ width, height }}
    />
  );
}
