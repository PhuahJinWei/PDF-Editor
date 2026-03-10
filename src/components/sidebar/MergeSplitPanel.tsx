'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Scissors } from 'lucide-react';
import { usePdfStore } from '@/stores/pdfStore';
import { extractPages, parsePageRange } from '@/lib/pdf/pdfSplitter';
import { saveAs } from 'file-saver';

export function MergeSplitPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [pageRange, setPageRange] = useState('');
  const pages = usePdfStore((s) => s.pages);
  const sources = usePdfStore((s) => s.sources);

  const handleExtract = async () => {
    if (!pageRange.trim() || sources.length === 0) return;

    const indices = parsePageRange(pageRange, pages.length);
    if (indices.length === 0) return;

    // For simplicity, extract from the first source
    // In a full implementation, we'd handle multi-source extraction
    const bytes = await extractPages(sources[0].bytes, indices);
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    saveAs(blob, 'extracted_pages.pdf');
    setPageRange('');
  };

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted hover:bg-gray-50"
      >
        <span className="flex items-center gap-1">
          <Scissors className="h-3 w-3" />
          Split / Extract
        </span>
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-2 px-3 pb-3">
          <input
            type="text"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            placeholder="e.g. 1-3, 5, 7"
            className="w-full rounded border border-border px-2 py-1 text-xs focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleExtract}
            disabled={!pageRange.trim()}
            className="w-full rounded bg-primary px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Extract Pages
          </button>
          <p className="text-[10px] text-muted">
            {pages.length} page{pages.length !== 1 ? 's' : ''} total
          </p>
        </div>
      )}
    </div>
  );
}
