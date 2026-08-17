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

-- One vote per part per email. Requests may repeat (each is a genuinely separate case).
create unique index if not exists demand_signals_vote_dedup
  on public.demand_signals (part_slug, lower(email))
  where type = 'vote';

-- One membership per email. A membership is a PERSON, not a case: re-submitting the join form
-- used to write a second row and send a second welcome, and would have duplicated every future
-- bulletin. The member number is deterministic (sha256 of ["member", email]), so a repeat claim
-- resolves to the same LCS-XXXXX and the API can answer "you are already in the book".
create unique index if not exists demand_signals_membership_dedup
  on public.demand_signals (lower(email))
  where type = 'membership';

-- Mailing-list state. The join form promises The Missing Knob, which is marketing mail: it needs
-- a one-click exit and a record of who took it. NULL = subscribed. Unsubscribing is deliberately
-- a stamp on the membership row rather than a delete, so a re-join cannot silently resurrect
-- someone who opted out and so the count of who left stays honest.
alter table public.demand_signals
  add column if not exists unsubscribed_at timestamptz;

create index if not exists demand_signals_part on public.demand_signals (part_slug);

alter table public.demand_signals enable row level security;
-- no policies = no access for anon/authenticated; service role bypasses RLS.
revoke all on public.demand_signals from public, anon, authenticated;
