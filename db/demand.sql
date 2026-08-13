-- demand_signals — the Society's demand ledger.
-- One row per signal of demand for a part: a full case-file request, a one-click vote,
-- or a membership claim (partless). This is the data that decides what gets digitized
-- next and when a group run clears breakeven.
--
-- Access model: the site's Vercel functions use the SERVICE role (server-side only).
-- anon/authenticated get NOTHING — RLS enabled, zero policies, and revoke the default
-- PUBLIC grants (Supabase grants through PUBLIC by default; revoking only `anon` is a
-- no-op — see the studio's supabase stack reference).

create table if not exists public.demand_signals (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null check (type in ('request', 'vote', 'membership')),
  part_slug   text,                       -- catalog slug when the part is known
  case_id     text,                       -- LCS-XXXXX for full requests
  email       text,                       -- voter/member/requester contact
  vehicle     text,                       -- requests: their car
  part_text   text,                       -- requests for parts not yet in the catalog
  oem         text,
  situation   text
);

-- One vote per part per email. Requests and memberships may repeat (each is a case).
create unique index if not exists demand_signals_vote_dedup
  on public.demand_signals (part_slug, lower(email))
  where type = 'vote';

create index if not exists demand_signals_part on public.demand_signals (part_slug);

alter table public.demand_signals enable row level security;
-- no policies = no access for anon/authenticated; service role bypasses RLS.
revoke all on public.demand_signals from public, anon, authenticated;
