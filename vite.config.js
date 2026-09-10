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
    // Peel the two cleanly-separable heavy pieces off the app bundle so an
    // app-code deploy (the common case) doesn't re-download ~73 KB gzip of
    // supabase + catalog that never changed. recharts/d3 and react are
    // deliberately left in the default vendor chunk — splitting recharts
    // out separately reorders module init in a way that trips a
    // "cannot access X before initialization" TDZ error at load. The
    // 855-entry catalog is repetitive data, ~16 KB gzip.
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
