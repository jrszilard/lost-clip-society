/**
 * POST /api/request — form intake for part requests and membership signups.
 *
 * Delivery, in order of preference:
 *   1. AgentMail (studio pattern, same as fattamano order alerts) when
 *      AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID + REQUESTS_NOTIFY_EMAIL are set —
 *      idempotent via client_id = case number.
 *   2. A generic JSON webhook when REQUESTS_WEBHOOK_URL is set.
 *   3. Otherwise `unconfigured`.
 *
 * Clients sending `Accept: application/json` (the page's fetch) get JSON.
 * Plain no-JS form posts get a 303: to /request/received/ on success, or to a
 * prefilled mailto: when delivery isn't configured yet.
 */
import type { APIRoute } from "astro";

export const prerender = false;

const MAILTO = "requests@lostclipsociety.com";

async function caseNumber(parts: string[]): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(parts.join("|").toLowerCase()),
  );
  const n = new Uint32Array(buf)[0];
  return `LCS-${n.toString(36).toUpperCase().padStart(7, "0").slice(0, 5)}`;
}

function text(...lines: (string | [string, string | undefined])[]): string {
  return lines
    .map((l) => (Array.isArray(l) ? (l[1] ? `${l[0]}  ${l[1]}` : null) : l))
    .filter((l): l is string => Boolean(l))
    .join("\n");
}

async function deliver(subject: string, body: string, clientId: string): Promise<"agentmail" | "webhook" | "unconfigured"> {
  const apiKey = import.meta.env.AGENTMAIL_API_KEY?.trim();
  const inboxId = import.meta.env.AGENTMAIL_INBOX_ID?.trim();
  const to = import.meta.env.REQUESTS_NOTIFY_EMAIL?.trim();
  if (apiKey && inboxId && to) {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/drafts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          text: body,
          client_id: clientId,
          send_at: new Date(Date.now() + 1000).toISOString(),
        }),
      },
    );
    if (!res.ok) throw new Error(`AgentMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return "agentmail";
  }
  const webhook = import.meta.env.REQUESTS_WEBHOOK_URL?.trim();
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, text: body, client_id: clientId }),
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}`);
    return "webhook";
  }
  return "unconfigured";
}

/**
 * Record a demand row (best-effort — a DB hiccup must never lose a submission;
 * the email already went out). Votes dedup via partial unique index; a conflict
 * just means this email already voted for this part.
 */
async function record(row: Record<string, string | null>): Promise<"ok" | "duplicate" | "unconfigured" | "error"> {
  const sbUrl = import.meta.env.SUPABASE_URL?.trim();
  const sbKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!sbUrl || !sbKey) return "unconfigured";
  try {
    const res = await fetch(`${sbUrl}/rest/v1/demand_signals`, {
      method: "POST",
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (res.status === 409) return "duplicate";
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

const wantsJson = (request: Request) => (request.headers.get("accept") ?? "").includes("application/json");

function respond(request: Request, json: object, status: number, redirectTo: string) {
  if (wantsJson(request)) {
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }
  return new Response(null, { status: 303, headers: { location: redirectTo } });
}

const mailtoFallback = (subject: string, body: string) =>
  `mailto:${MAILTO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const type = String(form.get("type") ?? "request");
  const email = String(form.get("email") ?? "").trim();

  // Honeypot: bots fill the invisible "company" field; real people never see it.
  const bot = String(form.get("company") ?? "").trim().length > 0;

  if (!bot && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(request, { ok: false, error: "email" }, 400, "/request/");
  }

  if (type === "membership") {
    const caseId = await caseNumber(["member", email]);
    const subject = `New Society member — ${email}`;
    const body = text("A new member claimed a number.", "", ["Email:", email], ["Case:", caseId], "",
      "They get The Missing Knob when a part moves forward.");
    if (!bot) {
      const via = await deliver(subject, body, caseId);
      if (via === "unconfigured") {
        return respond(request, { ok: false, unconfigured: true }, 503, mailtoFallback("Membership — The Lost Clip Society", `Sign me up: ${email}`));
      }
      await record({ type: "membership", email, case_id: caseId });
    }
    return respond(request, { ok: true, case: caseId }, 200, `/request/received/?case=${caseId}&type=membership`);
  }

  // One-click vote for a catalog part — the demand ledger's lightest signal.
  if (type === "vote") {
    const partSlug = String(form.get("part_slug") ?? "").trim();
    if (!/^[a-z0-9-]+$/.test(partSlug)) {
      return respond(request, { ok: false, error: "part" }, 400, "/registry/");
    }
    if (bot) return respond(request, { ok: true }, 200, `/registry/${partSlug}/`);
    const via = await record({ type: "vote", email, part_slug: partSlug });
    if (via === "unconfigured") {
      return respond(request, { ok: false, unconfigured: true }, 503, `/request/?part=${encodeURIComponent(partSlug)}`);
    }
    if (via === "error") {
      return respond(request, { ok: false, error: "db" }, 502, `/registry/${partSlug}/`);
    }
    return respond(request, { ok: true, duplicate: via === "duplicate" }, 200, `/registry/${partSlug}/`);
  }

  // Part request
  const name = String(form.get("name") ?? "").trim();
  const vehicle = String(form.get("vehicle") ?? "").trim();
  const part = String(form.get("part") ?? "").trim();
  const oem = String(form.get("oem") ?? "").trim();
  const situation = String(form.get("situation") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!bot && (!name || !vehicle || !part)) {
    return respond(request, { ok: false, error: "missing" }, 400, "/request/");
  }

  const caseId = await caseNumber([email, vehicle, part, oem, message]);
  const situationLabel =
    { "have-part": "Has the old part (even broken)", "on-car": "Part is stuck on the car", gone: "Part is gone entirely" }[situation] ?? situation;
  const subject = `Case ${caseId} — ${part} (${vehicle})`;
  const body = text(
    "A new case file was opened on lostclipsociety.com.", "",
    ["Case:", caseId],
    ["Name:", name],
    ["Email:", email],
    ["Vehicle:", vehicle],
    ["Part:", part],
    ["OEM №:", oem || "—"],
    ["Situation:", situationLabel || "—"], "",
    message ? `Notes:\n${message}` : "Notes: —", "",
    "Reply directly to the requester; reference the case number.",
  );
  const partSlug = String(form.get("part_slug") ?? "").trim();
  if (!bot) {
    const via = await deliver(subject, body, caseId);
    if (via === "unconfigured") {
      return respond(request, { ok: false, unconfigured: true }, 503,
        mailtoFallback(subject, `${body}\n\n(sent via email — the online desk isn't plugged in yet)`));
    }
    await record({
      type: "request", email, case_id: caseId, vehicle,
      part_text: part, oem: oem || null, situation: situationLabel || null,
      part_slug: /^[a-z0-9-]+$/.test(partSlug) ? partSlug : null,
    });
  }
  return respond(request, { ok: true, case: caseId }, 200, `/request/received/?case=${caseId}&type=request`);
};

export const GET: APIRoute = async () =>
  new Response(null, { status: 303, headers: { location: "/request/" } });
