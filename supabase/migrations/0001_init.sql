-- =============================================================================
-- Diabetic retinopathy screening prototype — schema
--
-- PROTOTYPE ONLY. The app ships with no authentication (deliberately out of
-- scope for V1), so the policies at the bottom of this file let the anon key
-- read and write everything. That is fine for synthetic demo data and is not
-- fine for anything else. Do not put real patient data in this project until
-- the policies are replaced — a hardened version is sketched at the end.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- sites -------------------------------------------------------------------
create table if not exists public.sites (
  id              text primary key,
  name            text not null,
  volume          integer not null default 0,
  rejection_rate  numeric(5,4) not null default 0
);

-- --- screenings --------------------------------------------------------------
create table if not exists public.screenings (
  id                  text primary key,
  patient             jsonb not null,
  site                text not null,
  created_at          timestamptz not null default now(),
  status              text not null
                        check (status in ('draft','pending_sync','analysis_pending',
                                          'awaiting_review','completed')),
  priority            text not null
                        check (priority in ('referable','low_confidence','ungradable','routine')),
  worst_grade         smallint check (worst_grade between 0 and 4),
  lowest_confidence   numeric(4,3) check (lowest_confidence between 0 and 1),
  referral_suggested  boolean not null default false,
  synced              boolean not null default true,
  demo_case_id        text,
  updated_at          timestamptz not null default now()
);

create index if not exists screenings_queue_idx
  on public.screenings (status, priority, created_at);

-- --- eye exams ---------------------------------------------------------------
-- One row per eye. `analysis` holds the model output verbatim (grade,
-- confidence, findings, lesion geometry, attention blobs) so a stored result is
-- always reproducible alongside the model version that produced it.
create table if not exists public.eye_exams (
  id            uuid primary key default gen_random_uuid(),
  screening_id  text not null references public.screenings (id) on delete cascade,
  side          text not null check (side in ('left','right')),
  image_src     text not null,
  image_label   text not null default '',
  visual_acuity text,
  quality       jsonb not null,
  analysis      jsonb,
  created_at    timestamptz not null default now(),
  unique (screening_id, side)
);

create index if not exists eye_exams_screening_idx on public.eye_exams (screening_id);

-- --- clinician decisions -----------------------------------------------------
create table if not exists public.reviews (
  screening_id          text primary key references public.screenings (id) on delete cascade,
  decision              text not null check (decision in ('refer','no_refer','ungradable')),
  disagreed_with_model  boolean not null default false,
  reason                text check (reason in ('interpretation','image_quality',
                                               'clinical_context','model_error','other')),
  clinician_name        text not null,
  decided_at            timestamptz not null default now(),
  -- A decision that differs from the model must say why. This is the audit
  -- trail the whole review workflow exists to produce.
  constraint reason_required_on_disagreement
    check (not disagreed_with_model or reason is not null)
);

-- --- audit log ---------------------------------------------------------------
create table if not exists public.audit_log (
  id            text primary key,
  screening_id  text not null,
  at            timestamptz not null default now(),
  actor         text not null,
  event         text not null,
  detail        text not null default ''
);

create index if not exists audit_log_screening_idx on public.audit_log (screening_id, at desc);

-- --- keep updated_at honest ---------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists screenings_touch on public.screenings;
create trigger screenings_touch
  before update on public.screenings
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- Row level security
-- =============================================================================
alter table public.sites       enable row level security;
alter table public.screenings  enable row level security;
alter table public.eye_exams   enable row level security;
alter table public.reviews     enable row level security;
alter table public.audit_log   enable row level security;

-- PROTOTYPE POLICIES: open to the anon key so the browser-only demo works with
-- no login. Replace before this touches a real patient.
do $$
declare t text;
begin
  foreach t in array array['sites','screenings','eye_exams','reviews','audit_log'] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_all', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Production shape, for when authentication lands. Roughly:
--
--   create policy screenings_read on public.screenings
--     for select to authenticated
--     using (site in (select site from public.staff_sites where user_id = auth.uid()));
--
--   create policy reviews_write on public.reviews
--     for insert to authenticated
--     with check (exists (select 1 from public.staff
--                         where user_id = auth.uid() and role = 'ophthalmologist'));
--
-- plus: move fundus images out of `image_src` into a private Storage bucket and
-- keep only the object path in the row.
-- -----------------------------------------------------------------------------
