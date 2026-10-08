alter table public.learn_notes
  drop constraint if exists learn_notes_content_text_check;

alter table public.learn_notes
  add constraint learn_notes_content_text_check
  check (char_length(content_text) <= 18000);
