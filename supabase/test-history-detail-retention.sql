create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cleanup_expired_test_history_details()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  history_row record;
  feedback jsonb;
begin
  for history_row in
    select id, ai_feedback
    from public.test_history
    where created_at < now() - interval '14 days'
      and left(ltrim(coalesce(ai_feedback, '')), 1) = '{'
  loop
    begin
      feedback := history_row.ai_feedback::jsonb;
    exception when others then
      continue;
    end;

    if jsonb_typeof(feedback) = 'object'
      and jsonb_typeof(feedback -> 'details') = 'array' then
      update public.test_history
      set ai_feedback = (feedback - 'details')::text
      where id = history_row.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.cleanup_expired_test_history_details() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-expired-test-history-details';

select cron.schedule(
  'cleanup-expired-test-history-details',
  '15 * * * *',
  $job$select public.cleanup_expired_test_history_details();$job$
);

select public.cleanup_expired_test_history_details();
