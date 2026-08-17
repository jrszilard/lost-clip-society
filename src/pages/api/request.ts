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
 * Two messages go out per submission: the internal alert (above) and a
 * confirmation to the person who filed the case. The alert carries reply_to =
 * requester, so answering it in the Proton mailbox reaches the customer rather
 * than the AgentMail API inbox.
 *
 * Clients sending `Accept: application/json` (the page's fetch) get JSON.
 * Plain no-JS form posts get a 303: to /request/received/ on success, or to a
 * prefilled mailto: when delivery isn't configured yet.
 */
import type { APIRoute } from "astro";

export const prerender = false;

const MAILTO = "requests@lostclipsociety.com";
// Absolute, not derived from the request: @astrojs/vercel reports url.origin as localhost
// (the Host header never reaches the renderer — the same trap that forced checkOrigin off),
// so a link built from the request would point at localhost in production.
const SITE = "https://lostclipsociety.com";

/**
 * Unsubscribe token: HMAC(secret, lower(email)). The member number cannot serve as the token —
 * it is derived by code in a PUBLIC repo, so anyone could compute it for any address.
 * Returns null when UNSUBSCRIBE_SECRET is unset, and every caller then omits the link rather
 * than shipping a broken one.
 */
async function unsubToken(email: string): Promise<string | null> {
  const secret = import.meta.env.UNSUBSCRIBE_SECRET?.trim();
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function unsubLink(email: string): Promise<string | null> {
  const t = await unsubToken(email);
  return t && `${SITE}/unsubscribe/?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${t}`;
}

export async function unsubTokenValid(email: string, token: string): Promise<boolean> {
  const t = await unsubToken(email);
  if (!t || !token || t.length !== token.length) return false;
  let diff = 0;                              // constant-time compare
  for (let i = 0; i < t.length; i++) diff |= t.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Clear an opt-out. An explicit re-join IS consent, and the dedup index means the row already exists. */
async function resubscribe(email: string): Promise<void> {
  const sbUrl = import.meta.env.SUPABASE_URL?.trim();
  const sbKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!sbUrl || !sbKey) return;
  try {
    await fetch(`${sbUrl}/rest/v1/demand_signals?type=eq.membership&email=ilike.${encodeURIComponent(email.trim())}`, {
      method: "PATCH",
      headers: {
        apikey: sbKey, Authorization: `Bearer ${sbKey}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ unsubscribed_at: null }),
    });
  } catch { /* best-effort: never fail a join over it */ }
}

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

async function deliver(subject: string, body: string, clientId: string, replyTo?: string): Promise<"agentmail" | "webhook" | "unconfigured"> {
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
          reply_to: replyTo ? [replyTo] : undefined,
          send_at: new Date(Date.now() + 1000).toISOString(),
        }),
      },
    );
    if (!res.ok) {
      // A reused client_id 404s once its draft is gone (sent, or aged out). The deterministic
      // case number makes that reachable in normal use: an identical resubmission derives the
      // same id, and the throw below would hand a real customer a 500. Retry ONCE under a fresh
      // id — the founder getting a duplicate alert is a far better failure than a lost intake.
      // A second failure is a genuine configuration problem (wrong inbox, bad key) and must stay
      // loud: silently swallowing it would recreate the "provider acceptance is not receipt"
      // trap this endpoint was already burned by.
      const body404 = (await res.text()).slice(0, 300);
      if (res.status === 404 || res.status === 409) {
        const retry = await fetch(
          `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/drafts`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              to,
              subject,
              text: body,
              client_id: `${clientId}-r${Date.now().toString(36)}`,
              reply_to: replyTo ? [replyTo] : undefined,
              send_at: new Date(Date.now() + 1000).toISOString(),
            }),
          },
        );
        if (retry.ok) return "agentmail";
        throw new Error(`AgentMail ${res.status} then retry ${retry.status}: ${body404}`);
      }
      throw new Error(`AgentMail ${res.status}: ${body404}`);
    }
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
 * Acknowledge the submission to the person who filed it (best-effort — the
 * internal alert is what must not be lost, so a failed confirmation never
 * surfaces as a failed submission). AgentMail only: there is no sensible
 * webhook equivalent of a customer email.
 *
 * client_id is suffixed rather than reusing the case number — that is the
 * alert's idempotency key, and colliding with it would drop this message.
 * reply_to is the Proton mailbox so a customer reply lands with a human,
 * not in the API inbox this was sent from.
 */
async function acknowledge(to: string, subject: string, body: string, clientId: string): Promise<boolean> {
  const apiKey = import.meta.env.AGENTMAIL_API_KEY?.trim();
  const inboxId = import.meta.env.AGENTMAIL_INBOX_ID?.trim();
  if (!apiKey || !inboxId) return false;
  try {
    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/drafts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          text: body,
          client_id: `${clientId}-ack`,
          reply_to: [MAILTO],
          send_at: new Date(Date.now() + 1000).toISOString(),
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
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
      // Membership records BEFORE emailing — the reverse of the request path. A membership is a
      // PERSON, not a case: the unique index makes a repeat claim a 409, and answering that
      // silently is the whole point (no second welcome, no duplicated bulletin). The
      // never-lose-a-signup property still holds, because only a definite `duplicate` short-
      // circuits; an unconfigured or broken DB falls through and still sends.
      const stored = await record({ type: "membership", email, case_id: caseId });
      if (stored === "duplicate") {
        await resubscribe(email);            // a re-join after opting out is fresh consent
        return respond(request, { ok: true, case: caseId, duplicate: true }, 200,
          `/request/received/?case=${caseId}&type=membership&again=1`);
      }
      const via = await deliver(subject, body, caseId, email);
      if (via === "unconfigured") {
        return respond(request, { ok: false, unconfigured: true }, 503, mailtoFallback("Membership — The Lost Clip Society", `Sign me up: ${email}`));
      }
      const leave = await unsubLink(email);
      await acknowledge(email, `You’re in the book — ${caseId}`, text(
        "You’re in the book.", "",
        ["Member №:", caseId], "",
        "The Missing Knob ships when a part moves forward — never for noise.",
        "Reply to this email any time; it reaches the workshop.", "",
        ...(leave ? [`Leaving is one click, any time:\n${leave}`, ""] : []),
        "— The Lost Clip Society",
        "  lostclipsociety.com",
      ), caseId);
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
    const via = await deliver(subject, body, caseId, email);
    if (via === "unconfigured") {
      return respond(request, { ok: false, unconfigured: true }, 503,
        mailtoFallback(subject, `${body}\n\n(sent via email — the online desk isn't plugged in yet)`));
    }
    await record({
      type: "request", email, case_id: caseId, vehicle,
      part_text: part, oem: oem || null, situation: situationLabel || null,
      part_slug: /^[a-z0-9-]+$/.test(partSlug) ? partSlug : null,
    });
    await acknowledge(email, `Case ${caseId} — received`, text(
      "Your case file is open.", "",
      ["Case:", caseId],
      ["Vehicle:", vehicle],
      ["Part:", part], "",
      "The paper trail starts today. We’ll write from the workshop within a few",
      "days — reply to this email and it goes straight to your case file.",
      "Photos of the original are welcome, broken or not.", "",
      "Nothing after a week? Reply here and reference your case number.", "",
      "— The Lost Clip Society",
      "  lostclipsociety.com",
    ), caseId);
  }
  return respond(request, { ok: true, case: caseId }, 200, `/request/received/?case=${caseId}&type=request`);
};

export const GET: APIRoute = async () =>
  new Response(null, { status: 303, headers: { location: "/request/" } });
