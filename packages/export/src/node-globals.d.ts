// Minimal Node typings for the test that reads a real IFC from disk. The
// package itself is browser-safe; only tests touch the filesystem.
declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string): void;
}

declare const process: { env: Record<string, string | undefined> };
