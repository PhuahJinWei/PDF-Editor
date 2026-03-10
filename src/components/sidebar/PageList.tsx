'use client';

import { useRef, useEffect } from 'react';
import { usePdfStore } from '@/stores/pdfStore';
import { useEditorStore } from '@/stores/editorStore';
import { PageThumbnail } from './PageThumbnail';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export function PageList() {
  const pages = usePdfStore((s) => s.pages);
  const reorderPages = usePdfStore((s) => s.reorderPages);
  const activePageIndex = useEditorStore((s) => s.activePageIndex);
  const setActivePageIndex = useEditorStore((s) => s.setActivePageIndex);
  const listRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Auto-scroll sidebar to show active thumbnail when it changes
  useEffect(() => {
    if (!listRef.current) return;
    const activeThumb = listRef.current.querySelector(
      `[data-thumbnail-index="${activePageIndex}"]`
    );
    activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activePageIndex]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      reorderPages(oldIndex, newIndex);
      setActivePageIndex(newIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={pages.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={listRef} className="flex flex-col gap-2">
          {pages.map((page, index) => (
            <PageThumbnail
              key={page.id}
              page={page}
              index={index}
              isActive={index === activePageIndex}
              onClick={() => {
                setActivePageIndex(index);
                // Scroll to page in editor
                const el = document.querySelector(`[data-page-index="${index}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
