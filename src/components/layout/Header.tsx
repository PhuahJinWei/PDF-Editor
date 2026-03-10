'use client';

import { useRef } from 'react';
import { FileUp, FilePlus, Download, FileText } from 'lucide-react';
import { usePdfStore } from '@/stores/pdfStore';
import { loadPdfDocument } from '@/lib/pdf/pdfLoader';
import { exportPdf } from '@/lib/pdf/pdfExporter';
import { readFileAsArrayBuffer, openPdfFile } from '@/lib/utils/fileHelpers';

export function Header() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const { sources, pages, fileName, addPdfForMerge } = usePdfStore();
  const hasDocument = pages.length > 0;

  const handleUpload = (file: File) => openPdfFile(file);

  const handleMerge = async (file: File) => {
    if (file.type !== 'application/pdf') return;
    const bytes = await readFileAsArrayBuffer(file);
    const sourceIndex = sources.length;
    const { pages: pageInfos } = await loadPdfDocument(bytes, sourceIndex);
    addPdfForMerge(bytes, file.name, pageInfos);
  };

  const handleExport = async () => {
    if (!hasDocument) return;
    const outputName = fileName.replace(/\.pdf$/i, '') + '_edited.pdf';
    await exportPdf(sources, pages, outputName);
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">PDF Editor</span>
        {fileName && (
          <span className="ml-2 text-xs text-muted">{fileName}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
        />
        <input
          ref={mergeInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleMerge(file);
            e.target.value = '';
          }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <FileUp className="h-3.5 w-3.5" />
          Upload PDF
        </button>

        {hasDocument && (
          <>
            <button
              onClick={() => mergeInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
            >
              <FilePlus className="h-3.5 w-3.5" />
              Add PDF
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </>
        )}
      </div>
    </header>
  );
}
