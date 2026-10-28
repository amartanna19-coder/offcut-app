# Offcut

A free local exchange for spare building materials. Tradespeople list offcuts and leftovers. Nearby DIYers and self-builders claim them. Android first.

**Stack:** Expo (React Native), Supabase (auth, Postgres, row-level security).

## Status

MVP marketplace. Working features:

- Sign up and sign in with email and password. A profile (display name, role, trade, area) is created automatically. Email addresses are never shown to other members.
- Browse live listings with search, category filters, and sort (newest or price). Results load in pages of 20 as you scroll.
- Photos on listings, uploaded from the phone and capped at 5 MB.
- Claim an item. Only one person can claim it, and the database enforces this.
- Collection window: a claim must be collected within 48 hours. If it isn't, the item returns to Browse automatically and the claimer gets a no-show. A scheduler checks every 15 minutes, using Supabase's `pg_cron`.
- Listers mark each claim as **Collected** or **No-show**. Collected claims add to the claimer's completed count. Claimers with 3 or more no-shows can't claim until the count is reviewed in the dashboard.
- Cancel your own claim so the item goes back to Browse.
- Report a listing for an unsafe, misleading, or spam listing. Reports are stored for you to review in the Supabase dashboard.
- My activity: your claims, your listings, remove a listing, and edit your profile.

Deliberately not included: in-app payments, messaging, and ratings. Payments would bring in regulation, and messaging needs moderation. Both are planned once the basics are proven.

## Upgrading an existing v1 database

The v2 schema changes the `listings` table, so don't re-run v1 over it. Back up the data first, then in the SQL editor create a fresh project, or run `supabase/schema.sql` on a copy. Users who signed up under v1 will need a row in `profiles`. Run this once:

```sql
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;
```

## Run it locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a free Supabase project at https://supabase.com. Then open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.

3. In Supabase, go to **Authentication > Providers > Email**. Turn off "Confirm email" while testing, so sign-up works without a confirmation step.

4. Copy the environment file and fill in your project URL and anon key from **Project Settings > API**:

   ```bash
   cp .env.example .env
   ```

5. Start the app:

   ```bash
   npm start
   ```

   Scan the QR code with the **Expo Go** app on Android, or press `a` to open an emulator.

## Build an Android APK (free)

The preview profile makes an installable APK. You can share it directly without the Play Store.

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Free Expo accounts include a limited number of builds per month. Check current limits at https://expo.dev.

## Google Play (optional, one-off £25)

When you're ready to publish, run `eas build -p android --profile production` to make an Android App Bundle, then upload it in the Google Play Console. Google charges a one-off registration fee.

## Before inviting real users

- Add a privacy notice covering what data you collect, why, and how long you keep it (UK GDPR).
- Add terms saying Offcut is a listing service only, and that the lister and claimer arrange handover themselves.
- Turn "Confirm email" back on in Supabase.
- Check public liability insurance once you arrange collections or take payments.
- Check the rules on giving away or selling building waste in your area.

## Project layout

```
App.js                      Root: auth gate, tab navigation
src/supabase.js             Supabase client
src/constants.js            Lists, sorts, price and photo helpers
src/screens/AuthScreen.js   Sign in and sign up
src/screens/BrowseScreen.js Search, filters, paged listings, claim, report
src/screens/ListScreen.js   Post a listing with a photo
src/screens/MineScreen.js   Profile, your claims and listings
supabase/schema.sql         Tables, storage bucket, and row-level security policies
```
