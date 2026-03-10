import type { Canvas, FabricObject } from 'fabric';
import { usePdfStore } from '@/stores/pdfStore';
import { useEditorStore } from '@/stores/editorStore';
import type { CanvasEntry } from '@/components/editor/FabricCanvas';

// ---------------------------------------------------------------------------
// Cross-page object transfer
// ---------------------------------------------------------------------------

/**
 * After a drag operation, check whether the dragged object(s) have moved
 * beyond the canvas bounds and, if so, transfer them to the adjacent page.
 *
 * Returns `true` if a transfer was initiated (the caller should skip its
 * normal `saveState()` call), or `false` if the object stayed on the page.
 */
export function attemptCrossPageTransfer(
  canvas: Canvas,
  target: FabricObject,
  pageId: string,
  saveState: () => void,
  transferInProgressRef: React.MutableRefObject<boolean>,
  registry: Map<string, CanvasEntry>,
): boolean {
  const center = target.getCenterPoint();
  const sceneHeight = canvas.height / canvas.getZoom();
  const sceneWidth = canvas.width / canvas.getZoom();

  const pages = usePdfStore.getState().pages;
  const pageIndex = pages.findIndex((p) => p.id === pageId);

  let adjacentIndex = -1;
  if (center.y < 0 && pageIndex > 0) {
    adjacentIndex = pageIndex - 1; // moved up
  } else if (center.y > sceneHeight && pageIndex < pages.length - 1) {
    adjacentIndex = pageIndex + 1; // moved down
  }

  if (adjacentIndex < 0) return false;

  const targetPageId = pages[adjacentIndex].id;
  const targetEntry = registry.get(targetPageId);
  if (!targetEntry) return false;

  // Determine if this is a multi-selection (ActiveSelection) or a single
  // object.  For multi-selection we must handle each child individually.
  const isMultiSelect = target.type === 'activeselection';
  const children = isMultiSelect ? [...canvas.getActiveObjects()] : [target];
  const singleSerialized = isMultiSelect ? null : target.toObject();

  // Defer the transfer so it runs outside Fabric's object:modified event
  // cycle, preventing infinite recursion.
  setTimeout(async () => {
    transferInProgressRef.current = true;
    const temporal = usePdfStore.temporal.getState();
    temporal.pause();

    try {
      let objectsData: object[];

      if (isMultiSelect) {
        // Discard selection first — this restores absolute positions on each
        // child (their left/top are group-relative while in ActiveSelection).
        canvas.discardActiveObject();
        canvas.renderAll();
        objectsData = children.map((obj) => obj.toObject());
      } else {
        objectsData = [singleSerialized!];
      }

      // Remove all objects from the source canvas
      children.forEach((obj) => canvas.remove(obj));
      canvas.renderAll();
      saveState();

      // Deserialize and add to target canvas
      const { util, FabricObject: FO } = await import('fabric');
      const newObjects = (await util.enlivenObjects(objectsData)) as InstanceType<typeof FO>[];

      // Compute Y offset for the target page
      const targetSceneHeight = targetEntry.canvas.height / targetEntry.canvas.getZoom();
      const targetSceneWidth = targetEntry.canvas.width / targetEntry.canvas.getZoom();
      const deltaY = adjacentIndex > pageIndex
        ? -sceneHeight       // moved down → shift up by source height
        : targetSceneHeight; // moved up → shift down by target height
      const xRatio = sceneWidth !== targetSceneWidth
        ? targetSceneWidth / sceneWidth
        : 1;

      for (const obj of newObjects) {
        obj.set({
          left: (obj.left ?? 0) * xRatio,
          top: (obj.top ?? 0) + deltaY,
        });
        targetEntry.canvas.add(obj);
      }

      // Select the transferred objects on the target canvas
      if (newObjects.length === 1) {
        targetEntry.canvas.setActiveObject(newObjects[0]);
      } else if (newObjects.length > 1) {
        const { ActiveSelection } = await import('fabric');
        const sel = new ActiveSelection(newObjects, { canvas: targetEntry.canvas });
        targetEntry.canvas.setActiveObject(sel);
      }

      targetEntry.canvas.requestRenderAll();
      targetEntry.saveState();

      // Switch to select tool and active page
      useEditorStore.getState().setActiveTool('select');
      useEditorStore.getState().setActivePageIndex(adjacentIndex);
    } catch (err) {
      console.warn('Cross-page transfer failed:', err);
    } finally {
      transferInProgressRef.current = false;
      temporal.resume();
    }
  }, 0);

  return true; // transfer initiated
}
