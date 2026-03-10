import { create } from 'zustand';
import { temporal } from 'zundo';
import type { EditorPage, NewPage, PdfSource } from '@/types/editor';

interface PdfState {
  sources: PdfSource[];
  pages: EditorPage[];
  fileName: string;

  loadPdf: (bytes: Uint8Array, fileName: string, pages: NewPage[]) => void;
  addPdfForMerge: (bytes: Uint8Array, fileName: string, pages: NewPage[]) => void;
  updatePageFabricState: (pageId: string, json: string) => void;
  updateThumbnail: (pageId: string, dataUrl: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  rotatePage: (pageId: string, degrees: number) => void;
  deletePage: (pageId: string) => void;
}

/** Default fields added to every new page. */
const PAGE_DEFAULTS = { fabricJson: null, thumbnailDataUrl: null, formFieldValues: {} } as const;

export const usePdfStore = create<PdfState>()(
  temporal(
    (set) => ({
      sources: [],
      pages: [],
      fileName: '',

      loadPdf: (bytes, fileName, pageInfos) =>
        set({
          sources: [{ bytes, fileName }],
          fileName,
          pages: pageInfos.map((p) => ({ ...p, ...PAGE_DEFAULTS })),
        }),

      addPdfForMerge: (bytes, fileName, pageInfos) =>
        set((state) => ({
          sources: [...state.sources, { bytes, fileName }],
          pages: [
            ...state.pages,
            ...pageInfos.map((p) => ({ ...p, ...PAGE_DEFAULTS })),
          ],
        })),

      updatePageFabricState: (pageId, json) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId ? { ...p, fabricJson: json } : p
          ),
        })),

      updateThumbnail: (pageId, dataUrl) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId ? { ...p, thumbnailDataUrl: dataUrl } : p
          ),
        })),

      reorderPages: (fromIndex, toIndex) =>
        set((state) => {
          const pages = [...state.pages];
          const [moved] = pages.splice(fromIndex, 1);
          pages.splice(toIndex, 0, moved);
          return { pages };
        }),

      rotatePage: (pageId, degrees) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === pageId
              ? { ...p, rotation: (p.rotation + degrees + 360) % 360 }
              : p
          ),
        })),

      deletePage: (pageId) =>
        set((state) => {
          const remaining = state.pages.filter((p) => p.id !== pageId);
          if (remaining.length === 0) {
            return { sources: [], pages: [], fileName: '' };
          }
          return { pages: remaining };
        }),
    }),
    {
      partialize: (state) => {
        const { sources, ...rest } = state;
        void sources;
        return {
          ...rest,
          // Strip thumbnailDataUrl from pages so undo/redo never reverts thumbnails
          pages: rest.pages.map(({ thumbnailDataUrl, ...page }) => {
            void thumbnailDataUrl;
            return { ...page, thumbnailDataUrl: null };
          }),
        };
      },
      limit: 50,
    }
  )
);
