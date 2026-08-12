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
  // checkOrigin compares the Origin header against the request URL's origin — but on
  // Vercel, functions see their URL as https://localhost (host header never reaches the
  // renderer), so EVERY browser form POST 403s in production while working in dev.
  // Our only POSTs are the public request/membership forms: no session to ride, spam is
  // handled by the honeypot. Off it goes.
  security: { checkOrigin: false },
});
