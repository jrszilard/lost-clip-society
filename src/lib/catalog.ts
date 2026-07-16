/**
 * catalog.ts — the site's ONLY data source.
 *
 * Pages are generated from the committed snapshot at src/data/parts.json, so the site
 * builds anywhere with plain `npm install && npm run build` — no access to the (private)
 * workshop repo required. The snapshot is regenerated on the workshop machine with
 * `node scripts/sync-catalog.mjs`.
 *
 * State ladder: requested → development → measured → fitted (on a real car).
 */
import raw from "../data/parts.json";

export type PartState = "requested" | "development" | "measured" | "fitted";

export interface Dim { name: string; mm: number | null; confidence: string }
export interface FitReport { vehicle: string; material: string; result: string }
export interface Part {
  slug: string;
  catalogId: string;
  oemNumber: string | null;
  title: string;
  description: string;
  yearRange: string;
  category: string;
  state: PartState;
  stateLabel: string;
  colors: string[];
  supersededTo: string | null;
  dims: Dim[];
  dimsConfirmed: number;
  dimsTotal: number;
  fitReports: FitReport[];
}

export function allParts(): Part[] {
  return raw as Part[];
}
