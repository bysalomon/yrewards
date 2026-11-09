-- Disposable PostgreSQL stubs for the minimum Supabase Auth/Storage contracts.
-- Run ONLY in the GitHub Actions test database.
create schema auth;
create schema storage;
create schema extensions;
create role anon;
create role authenticated;
create role service_role;
create table auth.users(
 id uuid primary key,
 email text,
 raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create or replace function auth.jwt() returns jsonb
language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
create table storage.buckets(
 id text primary key,
 name text not null,
 public boolean not null default false,
 file_size_limit bigint,
 allowed_mime_types text[]
);
create table storage.objects(
 id uuid primary key default gen_random_uuid(),
 bucket_id text not null,
 name text not null
);
