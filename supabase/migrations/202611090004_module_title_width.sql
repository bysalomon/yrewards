-- Align the legacy denormalised lesson module title with the new 120-character module names.
alter table public.club_lessons drop constraint if exists club_lessons_module_title_check;
alter table public.club_lessons add constraint club_lessons_module_title_check
 check(length(btrim(module_title)) between 2 and 120);
