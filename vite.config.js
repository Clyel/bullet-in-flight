import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5173, open: true },
  // GitHub Pages serves project sites from a /<repo-name>/ subpath, not the
  // domain root, so the production build's asset URLs need that prefix or
  // they'll 404 once deployed. Scoped to `build` only — applying it in dev
  // too makes the Vite dev server stop answering at plain localhost:5173.
  base: command === "build" ? "/bullet-in-flight/" : "/",
}));
