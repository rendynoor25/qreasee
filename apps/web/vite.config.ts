import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: false,
  },
  worker: {
    format: "es",
  },
  resolve: {
    dedupe: ["three", "react", "react-dom"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
