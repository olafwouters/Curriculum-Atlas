-- Additive integration migration. Apply only after review and tests.
create function public.atlas_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not atlas_private.is_facilitator() then raise exception 'Facilitator approval required' using errcode='42501'; end if;
 select jsonb_build_object('id',u.id,'email',u.email,'role',a.app_role) into result from auth.users u join atlas_private.facilitator_access a on a.email=lower(btrim(u.email)) where u.id=auth.uid() and a.enabled;
 return result;
end;
$$;
revoke all on function public.atlas_access() from public,anon,authenticated;
grant execute on function public.atlas_access() to authenticated;
create table public.shared_items (
 kind text not null check(kind in ('competence_set','library')),id text not null check(length(id) between 1 and 100),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=1000000),
 revision bigint not null default 1 check(revision>0),deleted boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,primary key(kind,id)
);
create unique index shared_competence_name_idx on public.shared_items(lower(btrim(data->>'name'))) where kind='competence_set' and not deleted;
create index shared_updated_by_idx on public.shared_items(updated_by);
alter table public.shared_items enable row level security;
revoke all on public.shared_items from public,anon,authenticated;
grant select on public.shared_items to authenticated;
create policy "Approved facilitators read shared resources" on public.shared_items for select to authenticated using ((select atlas_private.is_facilitator()));
create function public.atlas_write_shared(p_kind text,p_id text,p_data jsonb,p_delete boolean,p_expected_revision bigint default null)
returns public.shared_items language plpgsql security definer set search_path='' as $$
declare current_row public.shared_items%rowtype;
begin
 if not atlas_private.is_facilitator() then raise exception 'Facilitator approval required' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('competence_set','library') or p_id is null or length(p_id) not between 1 and 100 or p_delete is null then raise exception 'Invalid shared resource' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id,0));
 select * into current_row from public.shared_items where kind=p_kind and id=p_id for update;
 if found then
  if p_expected_revision is distinct from current_row.revision then raise exception 'Resource changed; reload before saving' using errcode='40001'; end if;
 elsif p_expected_revision is not null or (p_delete and p_kind='competence_set') then raise exception 'Shared resource not found' using errcode='P0002'; end if;
 if not p_delete then
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Resource data must be an object' using errcode='22023'; end if;
  if p_kind='competence_set' then
   if coalesce(length(btrim(p_data->>'name')),0)=0 or coalesce(jsonb_typeof(p_data->'outcomes'),'')<>'array' then raise exception 'Invalid competence set' using errcode='22023'; end if;
   if jsonb_array_length(p_data->'outcomes') not between 1 and 200 then raise exception 'Invalid competence-set size' using errcode='22023'; end if;
  elsif coalesce(length(btrim(p_data->>'title')),0)=0 then raise exception 'Library title required' using errcode='22023'; end if;
 end if;
 insert into public.shared_items as target(kind,id,data,deleted,updated_by)
 values(p_kind,p_id,case when p_delete then coalesce(current_row.data,'{}'::jsonb) else p_data end,p_delete,auth.uid())
 on conflict(kind,id) do update set data=excluded.data,deleted=excluded.deleted,revision=target.revision+1,updated_at=now(),updated_by=auth.uid() returning * into current_row;
 return current_row;
end;
$$;
revoke all on function public.atlas_write_shared(text,text,jsonb,boolean,bigint) from public,anon,authenticated;
grant execute on function public.atlas_write_shared(text,text,jsonb,boolean,bigint) to authenticated;
create function public.atlas_workspace_batch(p_items jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare entry record; w public.workspaces%rowtype; n integer:=0; size integer;
begin
 if not atlas_private.is_facilitator() then raise exception 'Facilitator approval required' using errcode='42501'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or p_action is null or p_action not in ('delete','restore','archive','unarchive') then raise exception 'Invalid workspace batch' using errcode='22023'; end if;
 size:=jsonb_array_length(p_items);
 if size not between 1 and 1000 then raise exception 'Select 1-1000 workspaces' using errcode='22023'; end if;
 if (select count(distinct x.id) from jsonb_to_recordset(p_items) as x(id uuid,revision bigint))<>size then raise exception 'Duplicate or missing workspace identifier' using errcode='22023'; end if;
 for entry in select * from jsonb_to_recordset(p_items) as x(id uuid,revision bigint) order by id loop
  select * into w from public.workspaces where id=entry.id for update;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if entry.revision is distinct from w.revision then raise exception 'Revision conflict; reload selection' using errcode='40001'; end if;
  if p_action in ('delete','restore') then perform public.set_workspace_deleted(w.id,w.revision,p_action='delete');
  else
   if w.deleted_at is not null then raise exception 'Restore deleted workspace first' using errcode='55000'; end if;
   perform public.save_workspace(case when p_action='archive' then w.state||jsonb_build_object('archived',true,'archivedAt',now()) else w.state-'archived'-'archivedAt' end,w.id,w.revision,false);
  end if;
  n:=n+1;
 end loop;
 return jsonb_build_object('count',n);
end;
$$;
revoke all on function public.atlas_workspace_batch(jsonb,text) from public,anon,authenticated;
grant execute on function public.atlas_workspace_batch(jsonb,text) to authenticated;
create function public.atlas_copy_workspace(p_source uuid,p_expected_revision bigint,p_state jsonb,p_archive boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare source_row public.workspaces%rowtype; new_row public.workspaces%rowtype;
begin
 if not atlas_private.is_facilitator() then raise exception 'Facilitator approval required' using errcode='42501'; end if;
 if p_archive is null then raise exception 'Archive flag required' using errcode='22023'; end if;
 select * into source_row from public.workspaces where id=p_source for update;
 if not found or source_row.deleted_at is not null then raise exception 'Source workspace not found' using errcode='P0002'; end if;
 if source_row.revision is distinct from p_expected_revision then raise exception 'Source changed; generate a new preview' using errcode='40001'; end if;
 new_row:=public.save_workspace(p_state-'archived'-'archivedAt',null,null,false);
 if p_archive then perform public.save_workspace(source_row.state||jsonb_build_object('archived',true,'archivedAt',now()),source_row.id,source_row.revision,false); end if;
 return new_row.id;
end;
$$;
revoke all on function public.atlas_copy_workspace(uuid,bigint,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.atlas_copy_workspace(uuid,bigint,jsonb,boolean) to authenticated;
