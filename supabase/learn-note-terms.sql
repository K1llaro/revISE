alter table public.learn_notes
  add column if not exists terms jsonb not null default '[]'::jsonb;
