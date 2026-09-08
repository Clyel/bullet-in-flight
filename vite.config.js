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
});
