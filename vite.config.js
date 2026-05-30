import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" emits relative asset URLs so the build works whether it's served
// from a user page (user.github.io) or a project page (user.github.io/ourcade/).
// HashRouter handles client-side routing, so no SPA 404 fallback is needed.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
