-- YVRewards academy: courses -> unlimited modules -> unlimited lessons.
-- Isolated to project zbchamxgnddeiktdxljo. Existing Member Club guides and progress are preserved.
create table public.club_courses (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 3 and 120),
 description text not null default '' check(length(description)<=2000),
 cover_url text check(cover_url is null or cover_url ~ '^https://'),
 cover_path text,
 sort_order integer not null default 1 check (sort_order>0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.club_modules (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.club_courses(id) on delete cascade,
 title text not null check (length(btrim(title)) between 2 and 120),
 description text not null default '' check(length(description)<=1500),
 sort_order integer not null default 1 check(sort_order>0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create index club_module_course_order on public.club_modules(course_id,sort_order,id);
alter table public.club_lessons add column module_id uuid references public.club_modules(id) on delete cascade;

-- Backfill every old lesson into a single introductory course, retaining lesson IDs
-- so prior entries in public.club_progress remain valid.
do $migrate$
declare v_course uuid;v_module uuid;v_title text;v_order integer:=0;
begin
 if exists (select 1 from public.club_lessons where module_id is null) then
  insert into public.club_courses(title,description,sort_order,active)
  values ('YVRewards Essentials','Start here. Learn how research tasks, the member workspace, wallet and programme rules work.',1,true)
  returning id into v_course;
  for v_title in select distinct module_title from public.club_lessons order by module_title loop
    v_order:=v_order+1;
    insert into public.club_modules(course_id,title,sort_order,active)
    values(v_course,v_title,v_order,true) returning id into v_module;
    update public.club_lessons set module_id=v_module where module_title=v_title and module_id is null;
  end loop;
 end if;
end $migrate$;
alter table public.club_lessons alter column module_id set not null;
alter table public.club_lessons drop constraint if exists club_lessons_module_title_sort_order_key;
alter table public.club_lessons drop constraint if exists club_lessons_sort_order_check;
alter table public.club_lessons add constraint club_lessons_positive_order check(sort_order>0);
create index club_lesson_module_order on public.club_lessons(module_id,sort_order,id);

alter table public.club_courses enable row level security;
alter table public.club_modules enable row level security;
create policy club_course_read on public.club_courses for select to authenticated
 using(active or public.admin_with_mfa());
create policy club_course_write on public.club_courses for all to authenticated
 using(public.admin_with_mfa()) with check(public.admin_with_mfa());
create policy club_module_read on public.club_modules for select to authenticated
 using(public.admin_with_mfa() or
  (active and exists(select 1 from public.club_courses c where c.id=course_id and c.active)));
create policy club_module_write on public.club_modules for all to authenticated
 using(public.admin_with_mfa()) with check(public.admin_with_mfa());

drop policy if exists club_lesson_read on public.club_lessons;
create policy club_lesson_read on public.club_lessons for select to authenticated
 using(public.admin_with_mfa() or (active and exists(
 select 1 from public.club_modules m join public.club_courses c on c.id=m.course_id
 where m.id=module_id and m.active and c.active
 )));
drop policy if exists club_progress_insert on public.club_progress;
create policy club_progress_insert on public.club_progress for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(
 select 1 from public.club_lessons l join public.club_modules m on m.id=l.module_id
 join public.club_courses c on c.id=m.course_id
 where l.id=lesson_id and l.active and m.active and c.active
 ));

revoke all on public.club_courses,public.club_modules from public,anon,authenticated;
grant select,insert,update,delete on public.club_courses,public.club_modules to authenticated;
-- Only the MFA-verified administrator passes the write RLS policies.

-- Public covers are intended marketing media, unlike the private ID-document bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('club-covers','club-covers',true,5242880,array['image/webp','image/png','image/jpeg'])
on conflict(id) do nothing;
create policy yvclub_covers_public on storage.objects for select to public
 using(bucket_id='club-covers');
create policy yvclub_covers_admin_upload on storage.objects for insert to authenticated
 with check(bucket_id='club-covers' and name like 'courses/%' and public.admin_with_mfa());
create policy yvclub_covers_admin_update on storage.objects for update to authenticated
 using(bucket_id='club-covers' and public.admin_with_mfa())
 with check(bucket_id='club-covers' and public.admin_with_mfa());
create policy yvclub_covers_admin_delete on storage.objects for delete to authenticated
 using(bucket_id='club-covers' and public.admin_with_mfa());
