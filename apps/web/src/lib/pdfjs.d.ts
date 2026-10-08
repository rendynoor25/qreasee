// Minimal types for the pdfjs-dist legacy build used only in tests.
declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const OPS: Record<string, number>;
  export interface PdfTextItem {
    str: string;
  }
  export interface PdfPage {
    getViewport(params: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
    getOperatorList(): Promise<{ fnArray: number[] }>;
  }
  export interface PdfDocument {
    numPages: number;
    getPage(n: number): Promise<PdfPage>;
  }
  export function getDocument(src: unknown): { promise: Promise<PdfDocument> };
}
