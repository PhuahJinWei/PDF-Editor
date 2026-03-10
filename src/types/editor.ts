export type Tool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'image';

export interface ToolSettings {
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  underline: boolean;
  highlightColor: string;
}

export interface EditorPage {
  id: string;
  pageIndex: number;
  sourceIndex: number; // which source PDF this page came from (0 = primary)
  rotation: number; // 0 | 90 | 180 | 270
  width: number; // original page width in PDF points
  height: number; // original page height in PDF points
  fabricJson: string | null; // serialized Fabric canvas state
  thumbnailDataUrl: string | null;
  formFieldValues: Record<string, string>;
}

/** Page info returned by the PDF loader (before Fabric/thumbnail state is attached). */
export type NewPage = Omit<EditorPage, 'fabricJson' | 'thumbnailDataUrl' | 'formFieldValues'>;

export interface PdfSource {
  bytes: Uint8Array;
  fileName: string;
}
