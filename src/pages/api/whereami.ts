// TEMPORARY debug endpoint — remove after the checkOrigin diagnosis.
import type { APIRoute } from "astro";
export const prerender = false;

export const ALL: APIRoute = async ({ request, url }) =>
  new Response(
    JSON.stringify({
      urlOrigin: url.origin,
      urlHref: url.href,
      originHeader: request.headers.get("origin"),
      host: request.headers.get("host"),
      xForwardedHost: request.headers.get("x-forwarded-host"),
      xForwardedProto: request.headers.get("x-forwarded-proto"),
    }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
