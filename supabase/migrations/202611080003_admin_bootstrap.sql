-- Robust admin bootstrap: normalise usernames derived from manually created Auth emails.
-- Applies ONLY to YRewards, never to voicetask-staging.
create or replace function public.initialise_member() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_username text;
  v_name text;
  v_suffix text:=left(replace(new.id::text,'-',''),8);
begin
  v_username:=lower(coalesce(nullif(new.raw_user_meta_data->>'username',''),split_part(new.email,'@',1)));
  v_username:=left(regexp_replace(v_username,'[^a-z0-9_]','_','g'),24);
  if length(v_username)<3 then
    v_username:='member_'||v_suffix;
  end if;
  if exists(select 1 from public.profiles where username=v_username) then
    v_username:=left(v_username,15)||'_'||v_suffix;
  end if;
  v_name:=trim(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'New member'));
  insert into public.profiles(id,username,full_name)
  values(new.id,v_username,v_name);
  insert into public.wallet_accounts(user_id) values(new.id);
  return new;
end $$;
revoke all on function public.initialise_member() from public,anon,authenticated;