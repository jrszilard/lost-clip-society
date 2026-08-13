/**
 * GET /api/demand?part=<slug> — live demand counts for a part.
 * Reads via the service role (server-side only); the table itself is locked to
 * anon entirely (RLS, no policies). Cached briefly at the edge.
 *
 *   { "part": "coat-hook", "votes": 3, "requests": 1, "total": 4 }
 *
 * When the DB isn't configured (local dev without env), returns zeros with
 * `configured: false` so the UI can stay quiet instead of lying.
 */
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const part = url.searchParams.get("part") ?? "";
  const sbUrl = import.meta.env.SUPABASE_URL?.trim();
  const sbKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!part || !/^[a-z0-9-]+$/.test(part)) {
    return Response.json({ error: "bad part" }, { status: 400 });
  }
  if (!sbUrl || !sbKey) {
    return Response.json({ part, votes: 0, requests: 0, total: 0, configured: false });
  }

  const q = (type: string) =>
    `${sbUrl}/rest/v1/demand_signals?select=id&part_slug=eq.${encodeURIComponent(part)}&type=eq.${type}`;
  const headers = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" };

  const [votesRes, reqsRes] = await Promise.all([fetch(q("vote"), { headers }), fetch(q("request"), { headers })]);
  if (!votesRes.ok || !reqsRes.ok) {
    return Response.json({ part, votes: 0, requests: 0, total: 0, configured: true, error: "db" }, { status: 502 });
  }
  const count = (r: Response) => Number((r.headers.get("content-range") ?? "*/0").split("/")[1]) || 0;
  const votes = count(votesRes);
  const requests = count(reqsRes);
  return Response.json(
    { part, votes, requests, total: votes + requests },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
};
