-- Disposable CI database ONLY; never run against a Supabase project.
do $$ begin if current_database()<>'catalogue_ci' then raise exception 'CI database required'; end if; end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
