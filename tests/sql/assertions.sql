-- Real PostgreSQL smoke checks on isolated, disposable YRewards schema.
do $checks$
declare
 v_user uuid:='11111111-1111-4111-8111-111111111111';
 v_video uuid;
 v_day record;
 v_wallet bigint;
 v_count int;
 v_seconds numeric;
 v_rejected boolean:=false;
 v_slots date[];
begin
 select public.withdrawal_slots(1,'2026-11-08'::date) into v_slots;
 if v_slots <> array['2026-11-08','2026-11-15','2026-11-22','2026-11-29']::date[]
 then raise exception 'Incorrect 7-day monthly schedule: %',v_slots;end if;
 select public.withdrawal_slots(27,'2027-02-08'::date) into v_slots;
 if v_slots <> array['2027-02-06','2027-02-13','2027-02-20','2027-02-27']::date[]
 then raise exception 'Incorrect February wrap: %',v_slots;end if;

 insert into auth.users(id,email,raw_user_meta_data)
 values(v_user,'alice@accounts.yrewards.invalid','{"username":"alice","full_name":"Alice Example"}'::jsonb);
 if not exists(select 1 from public.profiles where id=v_user)
 or not exists(select 1 from public.wallet_accounts where user_id=v_user)
 then raise exception 'Member bootstrap trigger failed';end if;
 perform set_config('test.user_id',v_user::text,false);
 select * into v_day from public.my_current_day();
 if v_day.day_number<>1 or v_day.cycle_number<>1 or v_day.unlocks_at>now()
 then raise exception 'Day 1 should open at registration';end if;

 insert into public.video_tasks(day_number,slot,brand_name,title,licensed_video_url,min_watch_seconds,reward_cents)
 values(1,1,'Example brand','Review this brand creative','https://cdn.example.com/video.mp4',10,125)
 returning id into v_video;
 perform public.track_video_playback(v_video,0,true);
 update public.video_watch_sessions set
   last_ping=clock_timestamp()-interval '12 seconds',
   started_at=now()-interval '30 seconds',
   last_position=0,was_playing=true
 where user_id=v_user and video_id=v_video;
 v_seconds:=public.track_video_playback(v_video,10,true);
 if v_seconds<10 then raise exception 'Watch telemetry did not accrue';end if;
 perform public.submit_video_feedback(v_video,true);
 select available_cents into v_wallet from public.wallet_accounts where user_id=v_user;
 if v_wallet<>125 then raise exception 'Wallet reward not credited';end if;
 select count(*) into v_count from public.wallet_ledger where user_id=v_user and kind='reward';
 if v_count<>1 then raise exception 'Ledger entry missing or duplicated';end if;

 begin
  perform public.submit_video_feedback(v_video,true);
 exception when others then v_rejected:=true;
 end;
 if not v_rejected then raise exception 'Repeat feedback was not blocked';end if;
 select available_cents into v_wallet from public.wallet_accounts where user_id=v_user;
 if v_wallet<>125 then raise exception 'Duplicate attempt affected wallet';end if;

 select * into v_day from public.my_current_day();
 if v_day.day_number<>2 or v_day.cycle_number<>1 or v_day.unlocks_at<=now()
 then raise exception 'Next day should be locked for 24 hours';end if;

 raise notice 'YRewards PostgreSQL smoke checks passed';
end $checks$;
