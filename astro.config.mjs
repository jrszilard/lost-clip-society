import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// Static site generated from the committed catalog snapshot (src/data/parts.json).
// Regenerate the snapshot on the workshop machine: node scripts/sync-catalog.mjs
//
// Pages stay static; routes with `export const prerender = false` (the /api/*
// form endpoints) deploy as Vercel functions.
export default defineConfig({
  site: "https://lostclipsociety.com",
  adapter: vercel(),
});
