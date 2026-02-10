import { defineConfig } from "vite";

export default defineConfig({
  // Use relative asset paths so the app works on GitHub Pages project sites
  // (e.g. /web-roq-installer/) and in other subpath deployments.
  base: "./",
});
