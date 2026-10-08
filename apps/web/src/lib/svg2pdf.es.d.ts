// W-07: the ESM build of svg2pdf.js is imported by subpath (Node resolves the
// package `main` to a UMD bundle that expects a global jsPDF). Declare it here.
declare module "svg2pdf.js/dist/svg2pdf.es.min.js" {
  import type { jsPDF } from "jspdf";
  export function svg2pdf(
    element: Element,
    pdf: jsPDF,
    options?: { x?: number; y?: number; width?: number; height?: number },
  ): Promise<jsPDF>;
}
