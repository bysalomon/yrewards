-- YRewards: standalone schema. NEVER run against VoiceTask.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'),
 full_name text not null check(length(trim(full_name)) between 3 and 120),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table public.admin_roles(user_id uuid primary key references auth.users(id) on delete cascade);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.admin_roles where user_id=(select auth.uid())) $$;
create or replace function public.admin_with_mfa() returns boolean language sql stable security definer set search_path=''
as $$ select public.is_admin() and coalesce((select auth.jwt()->>'aal'),'')='aal2' $$;
revoke all on function public.is_admin(),public.admin_with_mfa() from public,anon;
grant execute on function public.is_admin(),public.admin_with_mfa() to authenticated;

create table public.wallet_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 available_cents bigint not null default 0 check(available_cents>=0),
 reserved_cents bigint not null default 0 check(reserved_cents>=0),
 lifetime_cents bigint not null default 0 check(lifetime_cents>=0),
 updated_at timestamptz not null default now()
);
create or replace function public.initialise_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username,full_name)
 values(new.id,lower(coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1))),
 coalesce(new.raw_user_meta_data->>'full_name','New member'));
 insert into public.wallet_accounts(user_id) values(new.id);
 return new;
end $$;
create trigger init_yrewards_member after insert on auth.users
for each row execute function public.initialise_member();

create table public.invitations(
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '7 days'),
 claimed_at timestamptz,
 redeemed_by uuid unique references auth.users(id)
);
create or replace function public.claim_invitation(p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 update public.invitations set claimed_at=now()
 where token_hash=p_hash and claimed_at is null and redeemed_by is null and expires_at>now()
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.claim_invitation(text) from public,anon,authenticated;
grant execute on function public.claim_invitation(text) to service_role;

create table public.video_tasks(
 id uuid primary key default gen_random_uuid(),
 day_number int not null check(day_number between 1 and 30),
 slot int not null check(slot between 1 and 3),
 brand_name text not null check(length(trim(brand_name)) between 2 and 90),
 title text not null check(length(trim(title)) between 3 and 160),
 youtube_url text check(youtube_url is null or youtube_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/'),
 licensed_video_url text not null check(licensed_video_url ~ '^https://' and licensed_video_url !~* 'youtube\.com|youtu\.be|googlevideo\.com'),
 min_watch_seconds int not null check(min_watch_seconds between 10 and 3600),
 reward_cents int not null check(reward_cents between 1 and 100000),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(day_number,slot)
);
create table public.video_watch_sessions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 video_id uuid not null references public.video_tasks(id),
 cycle_number int not null check(cycle_number>0),
 played_seconds numeric(12,2) not null default 0,
 last_position numeric(12,2) not null default 0,
 last_ping timestamptz not null default now(),
 was_playing boolean not null default false,
 started_at timestamptz not null default now(),
 unique(user_id,video_id,cycle_number)
);
create table public.video_feedback(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 video_id uuid not null references public.video_tasks(id),
 cycle_number int not null check(cycle_number>0),
 day_number int not null check(day_number between 1 and 30),
 positive boolean not null,
 reward_cents int not null check(reward_cents>=0),
 created_at timestamptz not null default now(),
 unique(user_id,video_id,cycle_number)
);
create table public.day_completions(
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle_number int not null check(cycle_number>0),
 day_number int not null check(day_number between 1 and 30),
 completed_at timestamptz not null default now(),
 primary key(user_id,cycle_number,day_number)
);
create table public.payout_destinations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 method text not null check(method in ('paypal','bank')),
 account_details text not null check(length(trim(account_details)) between 5 and 300),
 verified boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.identity_verifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 document_path text not null,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.withdrawals(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 destination_id uuid not null references public.payout_destinations(id),
 amount_cents bigint not null check(amount_cents>0),
 status text not null default 'requested' check(status in ('requested','approved','processing','paid','declined')),
 reference text,
 staff_note text,
 reviewed_by uuid references auth.users(id),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index withdrawal_one_per_day on public.withdrawals(user_id,((requested_at at time zone 'UTC')::date));
create unique index paid_reference_unique on public.withdrawals(reference) where reference is not null and status='paid';
create table public.wallet_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 feedback_id uuid unique references public.video_feedback(id),
 withdrawal_id uuid references public.withdrawals(id),
 amount_cents bigint not null,
 kind text not null check(kind in ('reward','withdrawal_reserved','withdrawal_refunded','withdrawal_paid')),
 created_at timestamptz not null default now()
);
create index video_feedback_user on public.video_feedback(user_id,cycle_number,day_number);
create index withdrawal_status on public.withdrawals(status,requested_at);

create or replace function public.my_current_day()
returns table(cycle_number int,day_number int,unlocks_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_last public.day_completions%rowtype;v_joined timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select created_at into v_joined from public.profiles
 where id=auth.uid() and status='active';
 if not found then raise exception 'Account inactive';end if;
 select * into v_last from public.day_completions where user_id=auth.uid()
 order by cycle_number desc,day_number desc limit 1;
 if not found then return query select 1,1,v_joined;
 else return query select case when v_last.day_number=30 then v_last.cycle_number+1 else v_last.cycle_number end,
 case when v_last.day_number=30 then 1 else v_last.day_number+1 end,
 v_last.completed_at+interval '24 hours';
 end if;
end $$;

create or replace function public.track_video_playback(p_video uuid,p_position numeric,p_playing boolean)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_day record;v_video public.video_tasks%rowtype;v_session public.video_watch_sessions%rowtype;
 v_elapsed numeric;v_advance numeric;v_now timestamptz:=clock_timestamp();v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Sign in required';end if;
 select * into v_day from public.my_current_day();
 if v_now<v_day.unlocks_at then raise exception 'Next day locked';end if;
 select * into v_video from public.video_tasks
 where id=p_video and active and day_number=v_day.day_number;
 if not found then raise exception 'Video unavailable';end if;
 if p_position is null or p_position<0 or p_position>14400 then raise exception 'Invalid position';end if;
 insert into public.video_watch_sessions(user_id,video_id,cycle_number,last_position,last_ping,was_playing)
 values(v_user,p_video,v_day.cycle_number,p_position,v_now,false)
 on conflict(user_id,video_id,cycle_number) do nothing;
 select * into v_session from public.video_watch_sessions
 where user_id=v_user and video_id=p_video and cycle_number=v_day.cycle_number for update;
 v_elapsed:=greatest(0,extract(epoch from (v_now-v_session.last_ping)));
 v_advance:=p_position-v_session.last_position;
 if p_playing and v_session.was_playing and v_elapsed between 1 and 30
 and v_advance>0 and v_advance<=(v_elapsed*1.25+2) then
   update public.video_watch_sessions set played_seconds=played_seconds+least(v_advance,v_elapsed,10),
     last_position=p_position,last_ping=v_now,was_playing=true where id=v_session.id
   returning played_seconds into v_session.played_seconds;
 else
   update public.video_watch_sessions set last_position=p_position,last_ping=v_now,
      was_playing=p_playing where id=v_session.id;
 end if;
 return v_session.played_seconds;
end $$;

create or replace function public.submit_video_feedback(p_video uuid,p_positive boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_day record;v_video public.video_tasks%rowtype;v_session public.video_watch_sessions%rowtype;
 v_feedback uuid;v_total int;v_done int;v_wallet bigint;v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Sign in required';end if;
 select * into v_day from public.my_current_day();
 if now()<v_day.unlocks_at then raise exception 'Next day locked';end if;
 select * into v_video from public.video_tasks where id=p_video and active
  and day_number=v_day.day_number for update;
 if not found then raise exception 'Video unavailable';end if;
 select * into v_session from public.video_watch_sessions where
 user_id=v_user and video_id=p_video and cycle_number=v_day.cycle_number for update;
 if not found or v_session.played_seconds<v_video.min_watch_seconds
 or now()-v_session.started_at<make_interval(secs=>v_video.min_watch_seconds)
 then raise exception 'Minimum viewing period not completed';end if;
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

-- Four registration-anchored calendar dates; e.g. joined on the 1st => 8/15/22/29.
-- Dates wrap at the end of shorter months; at most one withdrawal per date.
create or replace function public.withdrawal_slots(p_join_day int,p_month date)
returns date[] language plpgsql immutable set search_path='' as $$
declare v_start date:=date_trunc('month',p_month)::date;
 v_days int;v_dates date[]:='{}'::date[];k int;v_day int;
begin
 if p_join_day<1 or p_join_day>31 then raise exception 'Invalid day';end if;
 v_days:=extract(day from (v_start+interval '1 month - 1 day'))::int;
 for k in 1..4 loop
 v_day:=((p_join_day-1+7*k)%v_days)+1;
 v_dates:=array_append(v_dates,v_start+(v_day-1));
 end loop;
 return (select array_agg(x order by x) from unnest(v_dates) x);
end $$;

create or replace function public.my_withdrawal_schedule()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_joined timestamptz;v_dates date[];v_today date:=(now() at time zone 'UTC')::date;
 v_count int;v_today_count int;
begin
 select created_at into v_joined from public.profiles where id=auth.uid() and status='active';
 if not found then raise exception 'Account unavailable';end if;
 v_dates:=public.withdrawal_slots(extract(day from v_joined at time zone 'UTC')::int,v_today);
 select count(*) into v_count from public.withdrawals where user_id=auth.uid()
 and date_trunc('month',requested_at at time zone 'UTC')=date_trunc('month',v_today::timestamp);
 select count(*) into v_today_count from public.withdrawals where user_id=auth.uid()
 and (requested_at at time zone 'UTC')::date=v_today;
 return jsonb_build_object('dates',v_dates,'is_day',v_today=any(v_dates),
 'eligible',v_today=any(v_dates) and v_today>=(v_joined at time zone 'UTC')::date+7
 and v_today_count=0 and v_count<4,
 'used_this_month',v_count,'remaining',greatest(0,4-v_count));
end $$;

create or replace function public.register_payout_destination(p_method text,p_details text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_method not in ('paypal','bank') or length(trim(p_details)) not between 5 and 300
 then raise exception 'Invalid payout destination';end if;
 insert into public.payout_destinations(user_id,method,account_details)
 values(auth.uid(),p_method,trim(p_details)) returning id into v_id;
 return v_id;
end $$;

create or replace function public.request_identity_review(p_path text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_path not like auth.uid()::text||'/%' or length(p_path)>400 or
 not exists(select 1 from storage.objects where bucket_id='identity-docs' and name=p_path)
 then raise exception 'Document upload not found';end if;
 insert into public.identity_verifications(user_id,document_path)
 values(auth.uid(),p_path) returning id into v_id;
 return v_id;
end $$;

create or replace function public.request_withdrawal(p_cents bigint,p_destination uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_schedule jsonb;v_account public.wallet_accounts%rowtype;
 v_id uuid;v_previous int;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 if p_cents<100 then raise exception 'Minimum withdrawal is $1.00';end if;
 if not exists(select 1 from public.payout_destinations where id=p_destination
 and user_id=v_user and verified) then raise exception 'Payment destination requires staff approval';end if;
 select count(*) into v_previous from public.withdrawals where user_id=v_user;
 if v_previous=0 and not exists(select 1 from public.identity_verifications
 where user_id=v_user and status='verified')
 then raise exception 'Identity verification is required for the first withdrawal';end if;
 select * into v_account from public.wallet_accounts where user_id=v_user for update;
 if not found or v_account.available_cents<p_cents then raise exception 'Insufficient balance';end if;
 v_schedule:=public.my_withdrawal_schedule();
 if coalesce((v_schedule->>'eligible')::boolean,false)=false then
 raise exception 'Withdrawals are available only on your scheduled dates';end if;
 update public.wallet_accounts set available_cents=available_cents-p_cents,
 reserved_cents=reserved_cents+p_cents,updated_at=now() where user_id=v_user;
 insert into public.withdrawals(user_id,destination_id,amount_cents)
 values(v_user,p_destination,p_cents) returning id into v_id;
 insert into public.wallet_ledger(user_id,withdrawal_id,amount_cents,kind)
 values(v_user,v_id,-p_cents,'withdrawal_reserved');
 return v_id;
end $$;

create or replace function public.admin_review_identity(p_id uuid,p_approved boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_with_mfa() then raise exception 'Admin MFA required';end if;
 update public.identity_verifications set status=case when p_approved then 'verified' else 'rejected' end,
 reviewed_by=auth.uid(),reviewed_at=now() where id=p_id and status='pending';
 return found;
end $$;
create or replace function public.admin_approve_destination(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_with_mfa() then raise exception 'Admin MFA required';end if;
 update public.payout_destinations set verified=true where id=p_id and not verified;
 return found;
end $$;
create or replace function public.admin_process_withdrawal(
 p_id uuid,p_action text,p_reference text default null,p_note text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_row public.withdrawals%rowtype;
begin
 if not public.admin_with_mfa() then raise exception 'Admin MFA required';end if;
 select * into v_row from public.withdrawals where id=p_id for update;
 if not found then raise exception 'Withdrawal not found';end if;
 if p_action='approve' and v_row.status='requested' then
 update public.withdrawals set status='approved',reviewed_by=auth.uid(),updated_at=now() where id=p_id;
 elsif p_action='processing' and v_row.status='approved' then
 update public.withdrawals set status='processing',reviewed_by=auth.uid(),updated_at=now() where id=p_id;
 elsif p_action='paid' and v_row.status='processing' then
 if length(trim(coalesce(p_reference,'')))<6 or length(trim(coalesce(p_note,'')))<15
 then raise exception 'External payment reference and full proof note required';end if;
 update public.wallet_accounts set reserved_cents=reserved_cents-v_row.amount_cents,updated_at=now()
 where user_id=v_row.user_id and reserved_cents>=v_row.amount_cents;
 if not found then raise exception 'Reserved funds unavailable';end if;
 update public.withdrawals set status='paid',reference=trim(p_reference),staff_note=trim(p_note),
 reviewed_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.wallet_ledger(user_id,withdrawal_id,amount_cents,kind)
 values(v_row.user_id,v_row.id,-v_row.amount_cents,'withdrawal_paid');
 elsif p_action='decline' and v_row.status in ('requested','approved','processing') then
 if length(trim(coalesce(p_note,'')))<10 then raise exception 'Decline reason required';end if;
 update public.wallet_accounts set reserved_cents=reserved_cents-v_row.amount_cents,
 available_cents=available_cents+v_row.amount_cents,updated_at=now()
 where user_id=v_row.user_id and reserved_cents>=v_row.amount_cents;
 if not found then raise exception 'Reserved funds unavailable';end if;
 update public.withdrawals set status='declined',staff_note=trim(p_note),
 reviewed_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.wallet_ledger(user_id,withdrawal_id,amount_cents,kind)
 values(v_row.user_id,v_row.id,v_row.amount_cents,'withdrawal_refunded');
 else raise exception 'Invalid payout state transition';end if;
 return true;
end $$;

alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.invitations enable row level security;
alter table public.video_tasks enable row level security;
alter table public.video_watch_sessions enable row level security;
alter table public.video_feedback enable row level security;
alter table public.day_completions enable row level security;
alter table public.payout_destinations enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.withdrawals enable row level security;

create policy profiles_read on public.profiles for select to authenticated
 using(id=(select auth.uid()) or public.is_admin());
create policy admins_read on public.admin_roles for select to authenticated
 using(user_id=(select auth.uid()));
create policy wallets_read on public.wallet_accounts for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy ledger_read on public.wallet_ledger for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy invite_read on public.invitations for select to authenticated using(public.admin_with_mfa());
create policy video_read on public.video_tasks for select to authenticated using(active or public.is_admin());
create policy video_admin_write on public.video_tasks for all to authenticated
 using(public.admin_with_mfa()) with check(public.admin_with_mfa());
create policy watch_read on public.video_watch_sessions for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy feedback_read on public.video_feedback for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy days_read on public.day_completions for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy destination_read on public.payout_destinations for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy identity_read on public.identity_verifications for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());
create policy withdrawal_read on public.withdrawals for select to authenticated
 using(user_id=(select auth.uid()) or public.is_admin());

revoke all on public.profiles,public.admin_roles,public.wallet_accounts,public.wallet_ledger,
public.invitations,public.video_tasks,public.video_watch_sessions,public.video_feedback,
public.day_completions,public.payout_destinations,public.identity_verifications,public.withdrawals
from public,anon,authenticated;
grant select on public.profiles,public.admin_roles,public.wallet_accounts,public.wallet_ledger,
public.invitations,public.video_tasks,public.video_watch_sessions,public.video_feedback,
public.day_completions,public.payout_destinations,public.identity_verifications,public.withdrawals to authenticated;
grant insert,update,delete on public.video_tasks to authenticated;
revoke all on function public.my_current_day(),public.track_video_playback(uuid,numeric,boolean),
public.submit_video_feedback(uuid,boolean),public.my_withdrawal_schedule(),
public.register_payout_destination(text,text),public.request_identity_review(text),
public.request_withdrawal(bigint,uuid),public.admin_review_identity(uuid,boolean),
public.admin_approve_destination(uuid),public.admin_process_withdrawal(uuid,text,text,text)
from public,anon;
grant execute on function public.my_current_day(),public.track_video_playback(uuid,numeric,boolean),
public.submit_video_feedback(uuid,boolean),public.my_withdrawal_schedule(),
public.register_payout_destination(text,text),public.request_identity_review(text),
public.request_withdrawal(bigint,uuid),public.admin_review_identity(uuid,boolean),
public.admin_approve_destination(uuid),public.admin_process_withdrawal(uuid,text,text,text)
to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('identity-docs','identity-docs',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do nothing;
create policy yrewards_kyc_upload on storage.objects for insert to authenticated
with check(bucket_id='identity-docs' and split_part(name,'/',1)=(select auth.uid())::text);
create policy yrewards_kyc_read on storage.objects for select to authenticated
using(bucket_id='identity-docs' and
(public.admin_with_mfa() or split_part(name,'/',1)=(select auth.uid())::text));
