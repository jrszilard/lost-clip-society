#!/usr/bin/env node
/**
 * sync-catalog.mjs — regenerate src/data/parts.json from the (private) venture repo.
 *
 * The site builds from the COMMITTED snapshot at src/data/parts.json, so collaborators
 * never need the venture repo. This script is for the workshop machine only: it reads
 * ../3d-car-parts-maker/{catalog,parts} and rewrites the snapshot.
 *
 *   node scripts/sync-catalog.mjs [path-to-venture-repo]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const venture = process.argv[2] ?? join(here, "..", "..", "3d-car-parts-maker");
if (!existsSync(join(venture, "catalog"))) {
  console.error(`No catalog/ at ${venture} — this script runs on the workshop machine only.`);
  process.exit(1);
}

const STATE_LABELS = {
  requested: "Requested",
  development: "In development",
  measured: "Measured",
  fitted: "Fitted on a real car",
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
const loadYaml = (p) => (existsSync(p) ? yaml.load(readFileSync(p, "utf8")) : null);

const parts = [];
for (const path of walk(join(venture, "catalog"))) {
  if (!path.endsWith("entry.yaml")) continue;
  const e = loadYaml(path);
  if (!e?.catalog_id) continue;
  if (e.scope_gate?.gate_status === "blocked") continue; // legal gate: never publish

  const slug = e.catalog_id.split("/").pop();
  const partRef = e.realizations?.[0]?.part_ref ?? null;
  const refDir = partRef ? join(venture, partRef) : null;

  const prov = refDir ? loadYaml(join(refDir, "dim-provenance.yaml")) : null;
  const version = refDir ? loadYaml(join(refDir, "version.yaml")) : null;

  const dims = (prov?.dimensions ?? [])
    .map((d) => ({
      name: d.name,
      mm: typeof d.value === "number" ? d.value : null,
      confidence: d.confidence ?? "estimated",
    }))
    .sort((a, b) => Number(b.confidence === "confirmed") - Number(a.confidence === "confirmed"));

  const fitReports = [];
  const fitDir = refDir ? join(refDir, "fit-confirmations") : null;
  if (fitDir && existsSync(fitDir)) {
    for (const f of readdirSync(fitDir)) {
      const rec = loadYaml(join(fitDir, f));
      if (!rec?.result) continue;
      fitReports.push({
        vehicle: [rec.vehicle?.year, rec.vehicle?.generation, rec.vehicle?.trim]
          .filter(Boolean).join(" "),
        material: rec.print?.material ?? "?",
        result: rec.result,
      });
    }
  }

  let state = "requested";
  if (partRef) {
    state = fitReports.some((r) => r.result === "pass")
      ? "fitted"
      : version?.status === "dim-verified"
        ? "measured"
        : "development";
  }

  const years = e.fits?.[0]?.year_range;
  const chain = e.supersession?.chain ?? [];
  parts.push({
    slug,
    catalogId: e.catalog_id,
    oemNumber: e.oem?.part_numbers?.[0]?.number ?? null,
    title: e.title ?? slug,
    description: (e.description ?? "").trim(),
    yearRange: years ? `’${String(years[0]).slice(2)}–’${String(years[1]).slice(2)}` : "",
    category: e.category ?? "",
    state,
    stateLabel: STATE_LABELS[state],
    colors: (e.color_finish?.oem_colors ?? []).map((c) => c.name).filter(Boolean),
    supersededTo: chain.length > 1 ? chain[chain.length - 1]?.part_number ?? null : null,
    dims,
    dimsConfirmed: dims.filter((d) => d.confidence === "confirmed").length,
    dimsTotal: dims.length,
    fitReports,
  });
}

const order = ["fitted", "measured", "development", "requested"];
parts.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));

const out = join(here, "..", "src", "data", "parts.json");
writeFileSync(out, JSON.stringify(parts, null, 2) + "\n");
console.log(`wrote ${out}: ${parts.length} parts (${parts.map((p) => p.state).join(", ")})`);
