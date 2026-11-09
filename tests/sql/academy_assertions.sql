-- New academy hierarchy smoke test on disposable PostgreSQL 17.
do $academy$
declare v_course uuid;v_second uuid;v_module uuid;v_lesson uuid;v_bob uuid:='22222222-2222-4222-8222-222222222222';v_n integer;
begin
 if (select count(*) from public.club_lessons where module_id is null)<>0
 then raise exception 'Backfill left lessons without modules';end if;
 if (select count(*) from public.club_courses)=0 or
    (select count(*) from public.club_modules)<2
 then raise exception 'Legacy course or its modules are missing';end if;
 if not exists(select 1 from public.club_progress p
 join public.club_lessons l on l.id=p.lesson_id where p.user_id=v_bob and l.module_id is not null)
 then raise exception 'Existing lesson progress was not retained';end if;
 insert into public.club_courses(title,description,cover_url,sort_order)
 values ('Long Form Learning','A full course','https://images.example.test/cover-9x16.webp',2) returning id into v_second;
 insert into public.club_modules(course_id,title,sort_order)
 values(v_second,'Module 250',250) returning id into v_module;
 insert into public.club_lessons(module_id,module_title,title,description,youtube_url,sort_order)
 values(v_module,'Module 250','Video beyond old 200 limit','Test','https://www.youtube.com/watch?v=abcdefghijk',251)
 returning id into v_lesson;
 if not exists(select 1 from public.club_lessons where id=v_lesson and sort_order=251)
 then raise exception 'More than 200 lessons per module should be allowed';end if;
 insert into public.club_modules(course_id,title,sort_order)
 values(v_second,'Another module',501);
 select count(*) into v_n from public.club_modules where course_id=v_second;
 if v_n<>2 then raise exception 'Multiple modules in one course failed';end if;
 select id into v_course from public.club_courses where title='YVRewards Essentials';
 if v_course is null then raise exception 'Legacy guides have no initial course';end if;
 if not exists(select 1 from public.club_lessons l
 join public.club_modules m on m.id=l.module_id
 where m.course_id=v_course and l.title='Welcome to YVRewards')
 then raise exception 'Legacy guide missing from starter course';end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='club_courses' and policyname='club_course_write')
 then raise exception 'Academy write RLS missing';end if;
 raise notice 'YVRewards academy hierarchy and preserved progress verified';
end $academy$;
