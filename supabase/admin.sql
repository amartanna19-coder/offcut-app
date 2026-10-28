-- Offcut admin queries. Run these in the Supabase SQL editor (Database > SQL Editor).
-- They run as the project owner, bypassing row-level security, so they are NOT exposed to the app.
-- Never add these functions to the client code or grant them to the authenticated role.

-- 1. Members currently blocked from claiming (3 or more no-shows).
select id, display_name, role, area, no_show_count, completed_count, created_at
  from public.profiles
 where no_show_count >= 3
 order by no_show_count desc;

-- 2. Recent reports, newest first, with the listing title.
select r.created_at, r.reason, r.details, l.title, l.status, l.id as listing_id
  from public.reports r
  join public.listings l on l.id = r.listing_id
 order by r.created_at desc
 limit 50;

-- 3. Lift a block after reviewing a member (replace the uuid).
-- Resets the no-show count to 2, so one more no-show blocks them again.
-- update public.profiles set no_show_count = 2 where id = '00000000-0000-0000-0000-000000000000';

-- 4. Remove a reported listing, keeping the report for the record.
-- update public.listings set status = 'removed' where id = '00000000-0000-0000-0000-000000000000';

-- 5. Check the scheduler is running and when it last ran.
select jobname, schedule, active
  from cron.job
 where jobname = 'offcut-release-expired-claims';

select status, start_time, end_time, return_message
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'offcut-release-expired-claims')
 order by start_time desc
 limit 10;
