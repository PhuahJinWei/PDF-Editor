import type { Canvas as FabricCanvas } from 'fabric';
import type { Tool, ToolSettings } from '@/types/editor';

async function ensureBrush(canvas: FabricCanvas) {
  if (!canvas.freeDrawingBrush) {
    const { PencilBrush } = await import('fabric');
    canvas.freeDrawingBrush = new PencilBrush(canvas);
  }
  return canvas.freeDrawingBrush!;
}

export async function configureTool(
  canvas: FabricCanvas,
  tool: Tool,
  settings: ToolSettings
) {
  // Reset canvas state
  canvas.isDrawingMode = false;
  canvas.defaultCursor = 'default';

  // Only select mode allows object selection and rubber-band
  canvas.selection = tool === 'select';
  canvas.forEachObject((obj) => {
    obj.selectable = tool === 'select';
    obj.evented = tool === 'select';
  });

  switch (tool) {
    case 'select':
      canvas.defaultCursor = 'default';
      break;

    case 'pen': {
      canvas.isDrawingMode = true;
      const brush = await ensureBrush(canvas);
      brush.color = settings.strokeColor;
      brush.width = settings.strokeWidth;
      break;
    }

    case 'highlighter': {
      canvas.isDrawingMode = true;
      const brush = await ensureBrush(canvas);
      brush.color = settings.highlightColor + '4D';
      brush.width = 20;
      break;
    }

    case 'eraser':
      canvas.defaultCursor = 'crosshair';
      // Objects need to be evented for eraser hit detection
      canvas.forEachObject((obj) => {
        obj.evented = true;
        obj.hoverCursor = 'crosshair';
      });
      break;

    case 'text':
      canvas.defaultCursor = 'text';
      break;

    case 'image':
      canvas.defaultCursor = 'crosshair';
      break;
  }
}
