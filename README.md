# lostclipsociety.com

The website for **The Lost Clip Society** — reproduction interior parts for classic cars,
measured from surviving originals and fitted on real cars.

Static [Astro](https://astro.build) site. Part pages are generated from the committed catalog
snapshot at `src/data/parts.json` — the site builds anywhere with no other dependencies.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
```

## For Wilma (design) 👋

- **The design system lives in [`src/styles/tokens.css`](src/styles/tokens.css)** — every
  color, typeface, and spacing value on the site, annotated. Components never hard-code
  values, so editing tokens restyles the whole site consistently.
- **Live reference: `/styleguide`** — renders every token and component; edit tokens,
  reload, and see the change everywhere.
- Voice + design rationale: [`BRAND.md`](BRAND.md).

## Pages

- `/` home · `/registry/` catalog · `/registry/<slug>/` part pages (generated from the snapshot)
- `/request/` request-a-part · `/method/` how fit verification works
- `/styleguide/` design-system reference

## Catalog data

`src/data/parts.json` is a generated snapshot — don't hand-edit it. It is refreshed from the
workshop's private catalog with `node scripts/sync-catalog.mjs` (workshop machine only).
