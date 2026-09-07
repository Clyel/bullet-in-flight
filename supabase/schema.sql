-- Ballistics Nerd — account system schema.
-- Run once in the Supabase SQL Editor for a freshly created project.
-- Locked with the user 2026-09-01: email+password auth (+ separate display
-- username), Recoil setups sync (new — they aren't persisted anywhere
-- today, not even locally), catalog-pick popularity stats (every picker
-- selection counts, not just saves), stats public/no-login-required.

-- ── profiles ──────────────────────────────────────────────────────────
-- One row per user, extends auth.users with the display name they log in
-- *as* (not what they log in *with* — that's still email, see the app's
-- sign-up form). Created automatically by the trigger below, not by app
-- code, so it can never be forgotten/skipped.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);
-- RLS policies alone aren't enough -- Postgres checks table-level GRANTs
-- first and denies access before a policy is ever evaluated. Without this,
-- a signed-in user gets "permission denied" the same as a guest would,
-- which is what actually happened when this was first tested live.
grant select, update on public.profiles to authenticated;

-- ── user_settings ─────────────────────────────────────────────────────
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "Users manage their own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.user_settings to authenticated;

-- ── saved_loads ───────────────────────────────────────────────────────
-- Mirrors Calculator.jsx's DEFAULTS form-state shape field-for-field, so
-- the sync layer is a straight read/write with no translation needed.
-- catalog_* columns are new: nullable, only set when the load came from
-- CommercialLoadPicker (never for a hand-typed load) — this is what makes
-- the cartridge-popularity stats possible from saved loads specifically,
-- separate from the broader pick-tracking in catalog_selection_events below.
create table public.saved_loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muzzle_velocity numeric not null,
  ballistic_coefficient numeric not null,
  grains numeric not null,
  drag_model text not null,
  sight_height numeric not null,
  zero_range_yd numeric not null,
  max_range_yd numeric not null,
  table_step_yd numeric not null,
  temp_f numeric not null,
  press_in_hg numeric not null,
  altitude_ft numeric,
  wind_speed_mph numeric,
  wind_clock numeric,
  vitals_radius_in numeric not null,
  catalog_cartridge text,
  catalog_manufacturer text,
  catalog_load_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saved_loads enable row level security;
create policy "Users manage their own saved loads" on public.saved_loads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.saved_loads to authenticated;

-- ── recoil_setups ─────────────────────────────────────────────────────
-- Net-new persistence — Recoil.jsx's rows are session-only React state
-- today, gone on refresh. Mirrors that row shape (see src/Recoil.jsx).
create table public.recoil_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rifle_weight_lb numeric not null,
  grains numeric not null,
  muzzle_velocity numeric not null,
  cartridge text,
  charge_gr numeric not null,
  charge_is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.recoil_setups enable row level security;
create policy "Users manage their own recoil setups" on public.recoil_setups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.recoil_setups to authenticated;

-- ── catalog_selection_events ──────────────────────────────────────────
-- Insert-only log, one row per commercial-round pick anywhere in the app
-- (Calculator, Optimal Zero, Recoil all route through the shared
-- CommercialLoadPicker component — tracking lives there once, not
-- duplicated per page). user_id is nullable and set to null for guests,
-- since picks are logged whether or not someone's signed in.
--
-- Known tradeoff, accepted for now at hobby scale: `with check (true)`
-- means literally anyone can insert without auth, which is what makes
-- guest tracking possible but is also a spam/abuse vector (someone could
-- script junk inserts to skew the public stats). Not worth solving
-- up front — if it ever becomes a real problem, the fix is routing
-- inserts through a Supabase Edge Function with basic rate-limiting
-- instead of a direct client insert, without changing this table shape.
create table public.catalog_selection_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  cartridge text not null,
  manufacturer text not null,
  load_id text not null,
  created_at timestamptz not null default now()
);
alter table public.catalog_selection_events enable row level security;
create policy "Anyone can log a catalog pick" on public.catalog_selection_events
  for insert with check (true);
-- Deliberately no select policy for regular users — nobody reads raw
-- rows (which would expose who picked what, even if user_id is usually
-- null). The public stats surface reads the aggregated view below instead.
-- anon needs the grant too, not just authenticated -- guest picks (no
-- signed-in session at all) are supposed to count, per the "every catalog
-- pick, no login required to contribute" decision.
grant insert on public.catalog_selection_events to anon, authenticated;

-- Public, anonymous-safe aggregate — counts only, never a user_id or a
-- timestamp of any individual pick. This is what the app's "Trending"
-- section actually queries; it needs no login to view per the user's
-- own call ("public, visible to everyone").
create view public.cartridge_popularity as
  select cartridge, manufacturer, count(*) as picks
  from public.catalog_selection_events
  group by cartridge, manufacturer
  order by picks desc;

grant select on public.cartridge_popularity to anon, authenticated;

-- ── auto-create profile + settings on sign-up ────────────────────────
-- Runs server-side on every new auth.users row, so a profile can never be
-- forgotten by a bug in client code. Expects the sign-up call to pass
-- `options: { data: { username } }` (Supabase's standard way to attach
-- metadata to a sign-up) — see the app's sign-up form.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
