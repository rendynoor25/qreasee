// Minimal Node typings for test-only file reads. The web app itself is
// browser-only; the PDF export test runs in Node under vitest and needs the
// embedded TTF bytes from `public/fonts`.
declare module "node:fs" {
  export function readFileSync(path: string): { toString(encoding?: string): string };
}

declare const process: { cwd(): string };
