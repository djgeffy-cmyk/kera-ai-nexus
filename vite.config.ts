import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// IMPORTANTE: Quando estamos buildando para o Electron Desktop, precisamos de
// `base: './'` porque os arquivos serão carregados via `file://`, não HTTP.
// A variável de ambiente ELECTRON_BUILD é setada pelo script `electron/build.cjs`.
export default defineConfig(({ mode }) => ({
  base: process.env.ELECTRON_BUILD === "true" ? "./" : "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
