begin;

alter table public.learn_notes
  add column if not exists curriculum_material_id uuid
  references public.curriculum_materials (id)
  on delete set null;

alter table public.learn_notes
  alter column content_text drop not null;

with matched_notes as (
  select
    note.id as note_id,
    material.id as material_id
  from public.learn_notes as note
  join lateral (
    select candidate.id
    from public.curriculum_materials as candidate
    where candidate.submitted_by = note.user_id
      and candidate.title = note.title
      and candidate.content_text = note.content_text
      and candidate.status = 'approved'
    order by candidate.created_at desc
    limit 1
  ) as material on true
  where note.curriculum_material_id is null
    and note.content_text is not null
)
update public.learn_notes as note
set curriculum_material_id = matched.material_id,
    content_text = null
from matched_notes as matched
where note.id = matched.note_id;

create index if not exists learn_notes_curriculum_material_id_idx
  on public.learn_notes (curriculum_material_id)
  where curriculum_material_id is not null;

commit;
