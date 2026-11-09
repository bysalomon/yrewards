-- Disposable YRewards PG17 integration checks for five-slot YouTube reference research.
do $test$
declare
 u uuid:='22222222-2222-4222-8222-222222222222';
 v4 uuid;v5 uuid;v_balance bigint;v_day record;
 refused boolean;v_lesson uuid;v_time timestamptz;
begin
 update public.video_tasks set active=false where day_number=1;
 insert into public.video_tasks(day_number,slot,brand_name,title,youtube_url,licensed_video_url,min_watch_seconds,reward_cents)
 values (1,4,'Example Studio','Creative research 04','https://www.youtube.com/watch?v=abcdefghijk',null,10,225) returning id into v4;
 insert into public.video_tasks(day_number,slot,brand_name,title,youtube_url,licensed_video_url,min_watch_seconds,reward_cents)
 values (1,5,'Example Studio','Creative research 05','https://www.youtube.com/watch?v=abcdefghijl',null,10,275) returning id into v5;
 refused:=false;
 begin
 insert into public.video_tasks(day_number,slot,brand_name,title,youtube_url,min_watch_seconds,reward_cents)
 values (1,6,'Example Studio','Invalid sixth creative','https://www.youtube.com/watch?v=abcdefghijm',10,100);
 exception when check_violation then refused:=true; end;
 if not refused then raise exception 'Sixth research slot was accepted';end if;

 insert into auth.users(id,email,raw_user_meta_data)
 values(u,'bob@accounts.yrewards.invalid','{"username":"bob","full_name":"Bob Researcher"}'::jsonb);
 perform set_config('test.user_id',u::text,false);
 select * into v_day from public.my_current_day();
 if v_day.day_number<>1 or v_day.unlocks_at>now() then raise exception 'Member day one unavailable';end if;

 refused:=false;
 begin perform public.begin_video_research(v5);
 exception when others then refused:=true;end;
 if not refused then raise exception 'Later research was available before earlier research';end if;
 select public.begin_video_research(v4) into v_time;
 if v_time is null then raise exception 'Research session not created';end if;
 refused:=false;
 begin perform public.submit_video_feedback(v4,true);
 exception when others then refused:=true;end;
 if not refused then raise exception 'Preparation minimum missing';end if;
 update public.video_research_sessions set started_at=now()-interval '30 seconds'
 where user_id=u and video_id=v4 and cycle_number=1;
 perform public.submit_video_feedback(v4,true);

 refused:=false;
 begin perform public.submit_video_feedback(v4,true);
 exception when others then refused:=true;end;
 if not refused then raise exception 'Duplicate YouTube-context feedback accepted';end if;
 perform public.begin_video_research(v5);
 update public.video_research_sessions set started_at=now()-interval '30 seconds'
 where user_id=u and video_id=v5 and cycle_number=1;
 perform public.submit_video_feedback(v5,false);
 select available_cents into v_balance from public.wallet_accounts where user_id=u;
 if v_balance<>500 then raise exception 'Incorrect independent-research credit: %',v_balance;end if;
 if (select count(*) from public.wallet_ledger where user_id=u and kind='reward')<>2
 then raise exception 'Research wallet ledger must contain two entries';end if;
 select * into v_day from public.my_current_day();
 if v_day.day_number<>2 or v_day.unlocks_at<=now() then
  raise exception 'Second research day must lock for 24 hours';end if;

 insert into public.club_lessons(module_title,title,description,youtube_url,sort_order)
 values('CI testing module','An introductory lesson','YVRewards training','https://www.youtube.com/watch?v=abcdefghijk',1)
 returning id into v_lesson;
 insert into public.club_progress(user_id,lesson_id) values(u,v_lesson);
 if not exists(select 1 from public.club_progress where user_id=u and lesson_id=v_lesson)
 then raise exception 'Member Club completion missing';end if;
 insert into public.member_preferences(user_id,reduced_motion,compact_cards,show_tips)
 values(u,true,true,false);
 if not exists(select 1 from public.member_preferences
 where user_id=u and reduced_motion and compact_cards and not show_tips)
 then raise exception 'Member preferences missing';end if;
 if public.update_member_name('Bob Research')<>'Bob Research'
 then raise exception 'Profile update unsuccessful';end if;
 raise notice 'YVRewards five-video, sequential-reward, club and account checks passed';
end $test$;
