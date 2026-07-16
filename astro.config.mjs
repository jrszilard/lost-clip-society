import { defineConfig } from "astro/config";

// Static site generated from the committed catalog snapshot (src/data/parts.json).
// Regenerate the snapshot on the workshop machine: node scripts/sync-catalog.mjs
export default defineConfig({
  site: "https://lostclipsociety.com",
});
