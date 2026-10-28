-- Offcut database schema for Supabase (v3: collection window, no-show tracking).
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run on a fresh project. On an existing v2 project, run it in a new query after backing up.

-- ---------------------------------------------------------------------------
-- Profiles: public display info only. Emails never leave auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Member' check (char_length(display_name) between 1 and 40),
  role text not null default 'DIY / self-builder' check (role in ('Tradesperson', 'DIY / self-builder', 'Community group')),
  trade text check (char_length(trade) <= 40),
  area text,
  completed_count integer not null default 0 check (completed_count >= 0),
  no_show_count integer not null default 0 check (no_show_count >= 0),
  created_at timestamptz not null default now()
);

-- Add the columns if upgrading from v2.
alter table public.profiles add column if not exists completed_count integer not null default 0;
alter table public.profiles add column if not exists no_show_count integer not null default 0;

alter table public.profiles enable row level security;

create policy "signed-in users read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Keep no_show_count private: members can read every other column, but not this one.
-- The app only reads the public columns, and blocking checks use can_claim() below.
revoke select on public.profiles from authenticated;
grant select (id, display_name, role, trade, area, completed_count, created_at) on public.profiles to authenticated;

-- Create a profile automatically on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Member'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  category text not null,
  price numeric(10, 2) not null default 0 check (price >= 0),
  condition text not null,
  area text not null,
  notes text check (char_length(notes) <= 500),
  photo_path text,
  lister_id uuid not null references public.profiles (id) on delete cascade,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  collect_by timestamptz,
  status text not null default 'available',
  created_at timestamptz not null default now()
);

-- Status values changed in v3 (added 'collected'), so replace the check constraint.
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('available', 'claimed', 'collected', 'removed', 'hidden'));

-- Columns added in v3, for projects upgrading from v2.
alter table public.listings add column if not exists claimed_at timestamptz;
alter table public.listings add column if not exists collect_by timestamptz;

create index if not exists listings_status_created_idx on public.listings (status, created_at desc);
create index if not exists listings_lister_idx on public.listings (lister_id);
create index if not exists listings_claimer_idx on public.listings (claimed_by);
create index if not exists listings_collect_by_idx on public.listings (status, collect_by);

alter table public.listings enable row level security;

-- Starts and clears the collection window automatically, so the app can't set its own deadline.
create or replace function public.set_claim_window()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'claimed' and old.status is distinct from 'claimed' then
    new.claimed_at := now();
    new.collect_by := now() + interval '48 hours';
  elsif new.status <> 'claimed' then
    new.claimed_at := null;
    new.collect_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_claim_window on public.listings;
create trigger listings_claim_window
  before update on public.listings
  for each row execute function public.set_claim_window();

-- True if this member is allowed to claim (fewer than 3 no-shows).
create or replace function public.can_claim(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select no_show_count < 3 from public.profiles where id = uid), false);
$$;

grant execute on function public.can_claim(uuid) to authenticated;

-- Signed-in users see live and claimed listings, plus their own in any state.
drop policy if exists "read live listings" on public.listings;
create policy "read live listings"
  on public.listings for select
  to authenticated
  using (
    status in ('available', 'claimed')
    or lister_id = auth.uid()
    or claimed_by = auth.uid()
  );

drop policy if exists "create own listings" on public.listings;
create policy "create own listings"
  on public.listings for insert
  to authenticated
  with check (lister_id = auth.uid() and status = 'available' and claimed_by is null);

-- Anyone other than the lister can claim an available listing, as themselves, unless blocked.
drop policy if exists "claim available listings" on public.listings;
create policy "claim available listings"
  on public.listings for update
  to authenticated
  using (status = 'available' and lister_id <> auth.uid())
  with check (
    status = 'claimed'
    and claimed_by = auth.uid()
    and public.can_claim(auth.uid())
  );

-- The claimer can release their own claim, returning the listing to available.
drop policy if exists "claimer cancels claim" on public.listings;
create policy "claimer cancels claim"
  on public.listings for update
  to authenticated
  using (status = 'claimed' and claimed_by = auth.uid())
  with check (status = 'available' and claimed_by is null);

-- Listers manage their own listings (edit, remove).
drop policy if exists "listers manage own listings" on public.listings;
create policy "listers manage own listings"
  on public.listings for update
  to authenticated
  using (lister_id = auth.uid())
  with check (lister_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lister outcomes. Use these instead of editing status directly, so counts stay accurate.
-- ---------------------------------------------------------------------------

-- The lister confirms the claimer collected the item.
create or replace function public.mark_collected(p_listing uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_claimer uuid;
begin
  update public.listings
     set status = 'collected'
   where id = p_listing
     and lister_id = auth.uid()
     and status = 'claimed'
  returning claimed_by into v_claimer;

  if v_claimer is null then
    raise exception 'No claimed listing of yours with that id';
  end if;

  update public.profiles
     set completed_count = completed_count + 1
   where id = v_claimer;
end;
$$;

-- The lister reports that the claimer didn't turn up. The listing goes back to Browse.
create or replace function public.mark_no_show(p_listing uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_claimer uuid;
begin
  select claimed_by into v_claimer
    from public.listings
   where id = p_listing
     and lister_id = auth.uid()
     and status = 'claimed'
   for update;

  if v_claimer is null then
    raise exception 'No claimed listing of yours with that id';
  end if;

  update public.listings
     set status = 'available', claimed_by = null
   where id = p_listing;

  update public.profiles
     set no_show_count = no_show_count + 1
   where id = v_claimer;
end;
$$;

grant execute on function public.mark_collected(uuid) to authenticated;
grant execute on function public.mark_no_show(uuid) to authenticated;

-- Releases claims that passed their collection window. Each one counts as a no-show.
-- Run by the scheduler below, not by the app.
create or replace function public.release_expired_claims()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  released integer := 0;
begin
  for r in
    select id, claimed_by
      from public.listings
     where status = 'claimed'
       and collect_by < now()
     for update skip locked
  loop
    update public.listings
       set status = 'available', claimed_by = null
     where id = r.id;

    update public.profiles
       set no_show_count = no_show_count + 1
     where id = r.claimed_by;

    released := released + 1;
  end loop;

  return released;
end;
$$;

revoke execute on function public.release_expired_claims() from public, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduler: release expired claims every 15 minutes.
-- If this block fails, enable the pg_cron extension under Database > Extensions,
-- then run just this block again.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  begin
    perform cron.unschedule('offcut-release-expired-claims');
  exception when others then
    null; -- job didn't exist yet
  end;
  perform cron.schedule(
    'offcut-release-expired-claims',
    '*/15 * * * *',
    $cron$select public.release_expired_claims()$cron$
  );
end $$;

-- ---------------------------------------------------------------------------
-- Reports: users can report a listing. Only you (the project owner) read them in the dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('Unsafe or hazardous', 'Not building material', 'Misleading', 'Spam or scam', 'Other')),
  details text check (char_length(details) <= 300),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

alter table public.reports enable row level security;

drop policy if exists "users create own reports" on public.reports;
create policy "users create own reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- No select policy: users cannot read reports. Review them in the Supabase dashboard.

-- ---------------------------------------------------------------------------
-- Photos: public read, each user can only write into their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "listing photos are public" on storage.objects;
create policy "listing photos are public"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "users upload to own photo folder" on storage.objects;
create policy "users upload to own photo folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own photos" on storage.objects;
create policy "users delete own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
