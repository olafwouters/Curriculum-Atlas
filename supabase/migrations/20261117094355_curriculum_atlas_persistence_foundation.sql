-- Curriculum Atlas: empty-project persistence foundation.
-- Run through Supabase migrations as postgres; no Auth accounts are created.
create schema atlas_private;
revoke all on schema atlas_private from public, anon, authenticated;
grant usage on schema atlas_private to authenticated;
create table atlas_private.facilitator_access (
 email text primary key check (email = lower(btrim(email))),
 app_role text not null default 'facilitator' check (app_role in ('admin','facilitator')),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table atlas_private.facilitator_access enable row level security;
revoke all on atlas_private.facilitator_access from public, anon, authenticated;
insert into atlas_private.facilitator_access(email,app_role)
values ('o.y.wouters@pl.hanze.nl','admin');

create function atlas_private.is_facilitator()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
  select 1 from auth.users u
  join atlas_private.facilitator_access a on a.email = lower(btrim(u.email))
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous,false) and a.enabled
 );
$$;
revoke all on function atlas_private.is_facilitator() from public, anon, authenticated;
grant execute on function atlas_private.is_facilitator() to authenticated;

create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 state jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 deleted_at timestamptz,
 deleted_by uuid references auth.users(id) on delete set null,
 purge_after timestamptz,
 constraint workspace_state_valid check (
  jsonb_typeof(state) = 'object'
  and coalesce(jsonb_typeof(state->'programme') = 'string',false)
  and coalesce(length(btrim(state->>'programme')) > 0,false)
  and coalesce(jsonb_typeof(state->'modules') = 'array',false)
  and octet_length(state::text) <= 5000000
 ),
 constraint workspace_deletion_valid check (
  (deleted_at is null and deleted_by is null and purge_after is null)
  or (deleted_at is not null and purge_after is not null
      and purge_after = deleted_at + interval '30 days')
 )
);
create index workspaces_updated_idx on public.workspaces(updated_at desc) where deleted_at is null;
create index workspaces_purge_idx on public.workspaces(purge_after) where deleted_at is not null;
create table public.workspace_sessions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null,
 state jsonb not null check (jsonb_typeof(state) = 'object'),
 workspace_revision bigint not null check (workspace_revision > 0),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null
);
create index workspace_sessions_workspace_idx on public.workspace_sessions(workspace_id,created_at desc);
create table atlas_private.workspace_events (
 id bigint generated always as identity primary key,
 workspace_id uuid,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('create','save','snapshot','delete','restore','purge')),
 revision bigint,
 occurred_at timestamptz not null default now()
);
alter table atlas_private.workspace_events enable row level security;
revoke all on atlas_private.workspace_events from public, anon, authenticated;
alter table public.workspaces enable row level security;
alter table public.workspace_sessions enable row level security;
revoke all on public.workspaces, public.workspace_sessions from public, anon, authenticated;
grant select on public.workspaces, public.workspace_sessions to authenticated;
create policy "Approved facilitators read shared workspaces"
on public.workspaces for select to authenticated
using ((select atlas_private.is_facilitator()) and (deleted_at is null or purge_after > now()));
create policy "Approved facilitators read shared sessions"
on public.workspace_sessions for select to authenticated
using ((select atlas_private.is_facilitator()) and exists (
 select 1 from public.workspaces w where w.id = workspace_id
 and (w.deleted_at is null or w.purge_after > now())
));

create function public.save_workspace(
 p_state jsonb, p_id uuid default null,
 p_expected_revision bigint default null, p_finish boolean default false
)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare
 w public.workspaces%rowtype;
 actor uuid := auth.uid();
 stamp timestamptz := now();
 event_action text;
begin
 if not atlas_private.is_facilitator() then
  raise exception 'Facilitator approval required' using errcode = '42501';
 end if;
 if p_state is null or jsonb_typeof(p_state) <> 'object' then
  raise exception 'Workspace state must be an object' using errcode = '22023';
 end if;
 if p_id is null then
  if p_expected_revision is not null then
   raise exception 'New workspaces cannot specify a revision' using errcode = '22023';
  end if;
  insert into public.workspaces(state,created_by,updated_by)
  values(p_state,actor,actor) returning * into w;
  event_action := 'create';
 else
  select * into w from public.workspaces where id = p_id for update;
  if not found then
   raise exception 'Workspace not found; do not recreate automatically' using errcode = 'P0002';
  end if;
  if w.deleted_at is not null then
   raise exception 'Workspace is deleted; restore before saving' using errcode = '55000';
  end if;
  if p_expected_revision is distinct from w.revision then
   raise exception 'Revision conflict; export changes and reopen workspace' using errcode = '40001';
  end if;
  update public.workspaces set state = p_state, revision = revision + 1,
   updated_at = stamp, updated_by = actor where id = p_id returning * into w;
  event_action := 'save';
 end if;
 insert into atlas_private.workspace_events(workspace_id,actor_id,action,revision)
 values(w.id,actor,event_action,w.revision);
 if coalesce(p_finish,false) then
  insert into public.workspace_sessions(workspace_id,title,state,workspace_revision,created_by)
  values(w.id,coalesce(nullif(w.state->>'sessionTitle',''),'Review'),w.state,w.revision,actor);
  insert into atlas_private.workspace_events(workspace_id,actor_id,action,revision)
  values(w.id,actor,'snapshot',w.revision);
 end if;
 return w;
end;
$$;

create function public.set_workspace_deleted(
 p_id uuid, p_expected_revision bigint, p_deleted boolean
)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare
 w public.workspaces%rowtype;
 actor uuid := auth.uid();
 stamp timestamptz := now();
begin
 if not atlas_private.is_facilitator() then
  raise exception 'Facilitator approval required' using errcode = '42501';
 end if;
 if p_deleted is null then
  raise exception 'Deletion flag is required' using errcode = '22023';
 end if;
 select * into w from public.workspaces where id = p_id for update;
 if not found then raise exception 'Workspace not found' using errcode = 'P0002'; end if;
 if p_expected_revision is distinct from w.revision then
  raise exception 'Revision conflict; reload before deleting or restoring' using errcode = '40001';
 end if;
 if p_deleted then
  if w.deleted_at is not null then
   raise exception 'Already deleted; recovery deadline unchanged' using errcode = '55000';
  end if;
 else
  if w.deleted_at is null or w.purge_after <= stamp then
   raise exception 'Workspace is not recoverable' using errcode = '55000';
  end if;
 end if;
 update public.workspaces set
  deleted_at = case when p_deleted then stamp else null end,
  deleted_by = case when p_deleted then actor else null end,
  purge_after = case when p_deleted then stamp + interval '30 days' else null end,
  revision = revision + 1, updated_at = stamp, updated_by = actor
 where id = p_id returning * into w;
 insert into atlas_private.workspace_events(workspace_id,actor_id,action,revision)
 values(w.id,actor,case when p_deleted then 'delete' else 'restore' end,w.revision);
 return w;
end;
$$;
revoke all on function public.save_workspace(jsonb,uuid,bigint,boolean) from public, anon, authenticated;
revoke all on function public.set_workspace_deleted(uuid,bigint,boolean) from public, anon, authenticated;
grant execute on function public.save_workspace(jsonb,uuid,bigint,boolean) to authenticated;
grant execute on function public.set_workspace_deleted(uuid,bigint,boolean) to authenticated;

create function atlas_private.purge_expired_workspaces()
returns bigint language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
 with removed as (
  delete from public.workspaces where deleted_at is not null and purge_after <= now()
  returning id,revision
 ), logged as (
  insert into atlas_private.workspace_events(workspace_id,action,revision)
  select id,'purge',revision from removed returning 1
 ) select count(*) into n from logged;
 return n;
end;
$$;
revoke all on function atlas_private.purge_expired_workspaces() from public, anon, authenticated;
comment on table public.workspaces is 'Shared Hanze workspaces. RLS reads; checked RPC writes; 30-day recovery.';
comment on table atlas_private.facilitator_access is 'Administrator-managed application approval, not user-editable metadata.';
