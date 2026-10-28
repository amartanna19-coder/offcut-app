-- Offcut database schema for Supabase (v2: profiles, photos, reports, cancel-claim).
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run on a fresh project. On an existing v1 project, run it in a new query after backing up.

-- ---------------------------------------------------------------------------
-- Profiles: public display info only. Emails never leave auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Member' check (char_length(display_name) between 1 and 40),
  role text not null default 'DIY / self-builder' check (role in ('Tradesperson', 'DIY / self-builder', 'Community group')),
  trade text check (char_length(trade) <= 40),
  area text,
  created_at timestamptz not null default now()
);

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
  status text not null default 'available' check (status in ('available', 'claimed', 'removed', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists listings_status_created_idx on public.listings (status, created_at desc);
create index if not exists listings_lister_idx on public.listings (lister_id);
create index if not exists listings_claimer_idx on public.listings (claimed_by);

alter table public.listings enable row level security;

-- Signed-in users see live and claimed listings, plus their own in any state.
create policy "read live listings"
  on public.listings for select
  to authenticated
  using (
    status in ('available', 'claimed')
    or lister_id = auth.uid()
    or claimed_by = auth.uid()
  );

-- You can only post as yourself, and only as a fresh available listing.
create policy "create own listings"
  on public.listings for insert
  to authenticated
  with check (lister_id = auth.uid() and status = 'available' and claimed_by is null);

-- Anyone other than the lister can claim an available listing, and only as themselves.
create policy "claim available listings"
  on public.listings for update
  to authenticated
  using (status = 'available' and lister_id <> auth.uid())
  with check (status = 'claimed' and claimed_by = auth.uid());

-- The claimer can release their own claim, returning the listing to available.
create policy "claimer cancels claim"
  on public.listings for update
  to authenticated
  using (status = 'claimed' and claimed_by = auth.uid())
  with check (status = 'available' and claimed_by is null);

-- Listers manage their own listings (edit, remove).
create policy "listers manage own listings"
  on public.listings for update
  to authenticated
  using (lister_id = auth.uid())
  with check (lister_id = auth.uid());

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

create policy "listing photos are public"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "users upload to own photo folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
