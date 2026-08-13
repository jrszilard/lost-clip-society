const OEM_IDENTITY_STATUSES = new Set(["confirmed", "candidate", "disputed", "unknown"]);
const FITMENT_STATUSES = new Set(["confirmed", "candidate", "disputed", "unknown"]);

/**
 * Project private OEM research into public-safe fields.
 *
 * Part-number rows remain in the private venture catalog when an identity is disputed so the
 * research trail is auditable. Public consumers only receive number/color/supersession claims
 * after the entry-level identity linkage is explicitly confirmed. Missing or invalid status is
 * fail-closed as "unknown".
 */
export function projectFitment(entry) {
  const fits = Array.isArray(entry?.fits) ? entry.fits : [];
  const fit = fits[0] ?? null;
  const rawStatus = fit?.status;
  const fitmentStatus = FITMENT_STATUSES.has(rawStatus) ? rawStatus : "unknown";

  return {
    fitmentStatus,
    yearRange: fitmentStatus === "confirmed" ? fit?.year_range ?? null : null,
    vehicleLabel: fitmentStatus === "confirmed"
      ? [fit?.make, fit?.model].filter(Boolean).join(" ") || null
      : null,
  };
}

export function projectOem(entry) {
  const rawStatus = entry?.oem?.identity?.status;
  const oemIdentityStatus = OEM_IDENTITY_STATUSES.has(rawStatus) ? rawStatus : "unknown";
  const confirmed = oemIdentityStatus === "confirmed";
  const numbers = Array.isArray(entry?.oem?.part_numbers) ? entry.oem.part_numbers : [];
  const primary = numbers.find((p) => p?.number && p.role !== "alternate")
    ?? numbers.find((p) => p?.number);
  const chain = Array.isArray(entry?.supersession?.chain) ? entry.supersession.chain : [];

  return {
    oemIdentityStatus,
    oemNumber: confirmed ? primary?.number ?? null : null,
    colors: confirmed
      ? (entry?.color_finish?.oem_colors ?? []).map((c) => c?.name).filter(Boolean)
      : [],
    supersededTo: confirmed && chain.length > 1
      ? chain[chain.length - 1]?.part_number ?? null
      : null,
  };
}
