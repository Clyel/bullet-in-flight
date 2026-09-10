import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // A bare GitHub Pages project site serves from a /<repo-name>/ subpath,
  // not the domain root -- but a custom domain bound to Pages (see
  // ballisticnerd.com in the repo's Pages settings) always serves from
  // its own root regardless of the underlying repo name, so this must be
  // "/" now, not "/bullet-in-flight/". If the custom domain is ever
  // removed, this needs to flip back to a command-conditional "/bullet-
  // in-flight/" for production or every asset 404s.
  base: "/",
  build: {
    // Name the two cleanly-separable heavy pieces as their own chunks so an
    // app-code deploy (the common case) doesn't bust ~75 KB gzip of
    // supabase + catalog in everyone's cache. supabase-js is already a
    // dynamic import (see supabaseClient.js) — this just gives its chunk a
    // stable name; the 855-entry catalog is repetitive data, ~16 KB gzip.
    // React stays in the entry chunk: the app is small enough that a
    // separate vendor chunk buys nothing.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@supabase/")) return "supabase";
          if (id.includes("/src/data/commercialAmmo")) return "catalog";
        },
      },
    },
  },
});
