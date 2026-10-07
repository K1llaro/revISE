create table if not exists public.learn_clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid not null references public.learn_sections(id) on delete cascade,
  selected_text text not null check (char_length(selected_text) between 1 and 4000),
  question text not null check (char_length(question) between 1 and 4000),
  answer text not null check (char_length(answer) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists learn_clarifications_user_section_created_idx
  on public.learn_clarifications (user_id, section_id, created_at desc);

alter table public.learn_clarifications enable row level security;

drop policy if exists "Users can read their own learn clarifications" on public.learn_clarifications;
create policy "Users can read their own learn clarifications"
  on public.learn_clarifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own learn clarifications" on public.learn_clarifications;
create policy "Users can create their own learn clarifications"
  on public.learn_clarifications for insert
  with check (
    auth.uid() = user_id
    and created_at >= now() - interval '7 days'
    and created_at <= now()
    and exists (
      select 1
      from public.learn_sections section
      where section.id = learn_clarifications.section_id
        and section.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own learn clarifications" on public.learn_clarifications;
create policy "Users can delete their own learn clarifications"
  on public.learn_clarifications for delete
  using (auth.uid() = user_id);

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-expired-learn-clarifications';

select cron.schedule(
  'cleanup-expired-learn-clarifications',
  '15 * * * *',
  $job$delete from public.learn_clarifications where created_at < now() - interval '7 days';$job$
);
