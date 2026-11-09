-- YRewards-only: five-slot video research and member club.
alter table public.video_tasks drop constraint if exists video_tasks_slot_check;
alter table public.video_tasks add constraint video_tasks_slot_check check(slot between 1 and 5);
alter table public.video_tasks alter column licensed_video_url drop not null;
alter table public.video_tasks add constraint video_tasks_media_check
 check (youtube_url is not null or licensed_video_url is not null);
-- Existing research assignments with YouTube URLs become YouTube-only.
-- Historical video watches and earned wallet credits remain untouched.
update public.video_tasks set licensed_video_url=null where youtube_url is not null;

create table public.video_research_sessions(
 user_id uuid not null references auth.users(id) on delete cascade,
 video_id uuid not null references public.video_tasks(id) on delete cascade,
 cycle_number int not null check(cycle_number>0),
 started_at timestamptz not null default now(),
 primary key(user_id,video_id,cycle_number)
);
alter table public.video_research_sessions enable row level security;
create policy research_sessions_read on public.video_research_sessions
 for select to authenticated
 using(user_id=(select auth.uid()) or public.admin_with_mfa());
revoke all on public.video_research_sessions from public,anon,authenticated;
grant select on public.video_research_sessions to authenticated;

create or replace function public.begin_video_research(p_video uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_day record;v_video public.video_tasks%rowtype;v_started timestamptz;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 select * into v_day from public.my_current_day();
 if now()<v_day.unlocks_at then raise exception 'Next day is locked';end if;
 select * into v_video from public.video_tasks
  where id=p_video and active and day_number=v_day.day_number;
 if not found then raise exception 'Research video unavailable';end if;
 if v_video.licensed_video_url is not null then raise exception 'Use authorised video playback for this assignment';end if;
 if exists(select 1 from public.video_tasks t where t.day_number=v_day.day_number
    and t.active and t.slot<v_video.slot
    and not exists(select 1 from public.video_feedback f where f.user_id=v_user
      and f.video_id=t.id and f.cycle_number=v_day.cycle_number))
 then raise exception 'Please complete the earlier reviews first';end if;
 insert into public.video_research_sessions(user_id,video_id,cycle_number)
 values(v_user,p_video,v_day.cycle_number) on conflict do nothing;
 select started_at into v_started from public.video_research_sessions
 where user_id=v_user and video_id=p_video and cycle_number=v_day.cycle_number;
 return v_started;
end $$;

create or replace function public.submit_video_feedback(p_video uuid,p_positive boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_day record;v_video public.video_tasks%rowtype;v_session public.video_watch_sessions%rowtype;
 v_feedback uuid;v_total int;v_done int;v_wallet bigint;v_user uuid:=auth.uid();v_started_at timestamptz;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 select * into v_day from public.my_current_day();
 if now()<v_day.unlocks_at then raise exception 'Next day locked';end if;
 select * into v_video from public.video_tasks where id=p_video and active
  and day_number=v_day.day_number for update;
 if not found then raise exception 'Video unavailable';end if;

 -- A research response is a distinct service from YouTube playback.
 -- The YouTube iframe is optional context and NEVER a paid view.
 if exists (
   select 1 from public.video_tasks t
   where t.day_number=v_day.day_number and t.active and t.slot<v_video.slot
   and not exists(select 1 from public.video_feedback f
     where f.user_id=v_user and f.video_id=t.id and f.cycle_number=v_day.cycle_number)
 ) then raise exception 'Please complete the earlier reviews first';end if;
 if v_video.licensed_video_url is null then
   select started_at into v_started_at from public.video_research_sessions
   where user_id=v_user and video_id=p_video and cycle_number=v_day.cycle_number;
   if v_started_at is null or now()<v_started_at+make_interval(secs=>v_video.min_watch_seconds)
     then raise exception 'Please complete the independent research preparation period';end if;
 else
   select * into v_session from public.video_watch_sessions where
    user_id=v_user and video_id=p_video and cycle_number=v_day.cycle_number for update;
   if not found or v_session.played_seconds<v_video.min_watch_seconds
    or now()-v_session.started_at<make_interval(secs=>v_video.min_watch_seconds)
   then raise exception 'Minimum viewing period not completed';end if;
 end if;
 insert into public.video_feedback(user_id,video_id,cycle_number,day_number,positive,reward_cents)
 values(v_user,p_video,v_day.cycle_number,v_day.day_number,p_positive,v_video.reward_cents)
 returning id into v_feedback;
 update public.wallet_accounts set available_cents=available_cents+v_video.reward_cents,
 lifetime_cents=lifetime_cents+v_video.reward_cents,updated_at=now()
 where user_id=v_user returning available_cents into v_wallet;
 if not found then raise exception 'Wallet unavailable';end if;
 insert into public.wallet_ledger(user_id,feedback_id,amount_cents,kind)
 values(v_user,v_feedback,v_video.reward_cents,'reward');
 select count(*) into v_total from public.video_tasks where day_number=v_day.day_number and active;
 select count(*) into v_done from public.video_feedback f
 join public.video_tasks t on t.id=f.video_id and t.active and t.day_number=v_day.day_number
 where f.user_id=v_user and f.cycle_number=v_day.cycle_number;
 if v_total>0 and v_done=v_total then
 insert into public.day_completions(user_id,cycle_number,day_number)
 values(v_user,v_day.cycle_number,v_day.day_number);
 end if;
 return jsonb_build_object('reward_cents',v_video.reward_cents,'wallet_cents',v_wallet,
 'day_completed',(v_total>0 and v_done=v_total));
end $$;



revoke all on function public.begin_video_research(uuid) from public,anon;
grant execute on function public.begin_video_research(uuid) to authenticated;

create table public.club_lessons(
 id uuid primary key default gen_random_uuid(),
 module_title text not null default 'Getting started'
    check(length(trim(module_title)) between 2 and 80),
 title text not null check(length(trim(title)) between 3 and 140),
 description text not null default '' check(length(description)<=1500),
 youtube_url text not null check(youtube_url~'^https://(www\.)?(youtube\.com|youtu\.be)/'),
 sort_order int not null default 1 check(sort_order between 1 and 200),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(module_title,sort_order)
);
create table public.club_progress(
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null references public.club_lessons(id) on delete cascade,
 completed_at timestamptz not null default now(),
 primary key(user_id,lesson_id)
);
alter table public.club_lessons enable row level security;
alter table public.club_progress enable row level security;
create policy club_lesson_read on public.club_lessons for select to authenticated
 using(active or public.admin_with_mfa());
create policy club_lesson_admin_write on public.club_lessons for all to authenticated
 using(public.admin_with_mfa()) with check(public.admin_with_mfa());
create policy club_progress_read on public.club_progress for select to authenticated
 using(user_id=(select auth.uid()) or public.admin_with_mfa());
create policy club_progress_insert on public.club_progress for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.club_lessons l
 where l.id=lesson_id and l.active));
revoke all on public.club_lessons,public.club_progress from public,anon,authenticated;
grant select on public.club_lessons,public.club_progress to authenticated;
grant insert,update,delete on public.club_lessons to authenticated;
grant insert on public.club_progress to authenticated;

create table public.member_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 reduced_motion boolean not null default false,
 compact_cards boolean not null default false,
 show_tips boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.member_preferences enable row level security;
create policy pref_read on public.member_preferences for select to authenticated
 using(user_id=(select auth.uid()));
create policy pref_insert on public.member_preferences for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy pref_update on public.member_preferences for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.member_preferences from public,anon,authenticated;
grant select,insert,update on public.member_preferences to authenticated;

create or replace function public.update_member_name(p_full_name text)
returns text language plpgsql security definer set search_path='' as $$
declare v_full text:=trim(regexp_replace(coalesce(p_full_name,''),'\s+',' ','g'));
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if length(v_full)<3 or length(v_full)>120 then raise exception 'Please provide your full name (3-120 characters)';end if;
 update public.profiles set full_name=v_full
 where id=auth.uid() and status='active';
 if not found then raise exception 'Profile not found or inactive';end if;
 return v_full;
end $$;
revoke all on function public.update_member_name(text) from public,anon;
grant execute on function public.update_member_name(text) to authenticated;
