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
export type OemIdentityStatus = "confirmed" | "candidate" | "disputed" | "unknown";
export type FitmentStatus = "confirmed" | "candidate" | "disputed" | "unknown";

export interface Dim { name: string; mm: number | null; confidence: string }
export interface FitReport { vehicle: string; material: string; result: string }
export interface Part {
  slug: string;
  catalogId: string;
  oemIdentityStatus: OemIdentityStatus;
  oemNumber: string | null;
  title: string;
  description: string;
  fitmentStatus: FitmentStatus;
  vehicleLabel: string | null;
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

export function fitmentLabel(part: Part): string {
  if (part.fitmentStatus === "confirmed" && part.vehicleLabel) {
    return `${part.yearRange} ${part.vehicleLabel}`.trim();
  }
  if (part.fitmentStatus === "disputed") return "Vehicle/trim fitment under investigation";
  if (part.fitmentStatus === "candidate") return "Vehicle/trim fitment being verified";
  return "Vehicle/trim fitment pending";
}

export function oemIdentityLabel(part: Part): string {
  if (part.oemIdentityStatus === "confirmed" && part.oemNumber) {
    return `OEM № ${part.oemNumber}`;
  }
  if (part.oemIdentityStatus === "disputed") return "OEM identity under investigation";
  if (part.oemIdentityStatus === "candidate") return "OEM identity being verified";
  return "OEM № pending";
}
