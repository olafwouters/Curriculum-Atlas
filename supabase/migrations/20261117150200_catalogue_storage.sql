-- Additive catalogue storage. Apply separately after approval; never edits workspaces.
create table atlas_private.catalogue_versions (
 id uuid primary key,
 generation bigint generated always as identity unique,
 edition text not null check (edition ~ '^20[0-9]{2}$'),
 status text not null default 'building' check (status in ('building','published','failed')),
 manifest jsonb not null default '{}' check (jsonb_typeof(manifest)='object'),
 checkpoint jsonb not null default '{}' check (jsonb_typeof(checkpoint)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 unique(id,edition)
);
create table atlas_private.catalogue_entries (
 version_id uuid not null references atlas_private.catalogue_versions(id),
 lang text not null check (lang in ('nl','en')),
 path text not null,
 kind text not null check (kind in ('programme','course')),
 summary jsonb not null check (jsonb_typeof(summary)='object'),
 document jsonb not null check (jsonb_typeof(document)='object'),
 primary key(version_id,lang,path)
);
create index catalogue_entries_search on atlas_private.catalogue_entries(version_id,lang,kind,path);
create table atlas_private.catalogue_heads (
 edition text primary key,
 version_id uuid not null,
 foreign key(version_id,edition) references atlas_private.catalogue_versions(id,edition)
);
alter table atlas_private.catalogue_versions enable row level security;
alter table atlas_private.catalogue_entries enable row level security;
alter table atlas_private.catalogue_heads enable row level security;
revoke all on atlas_private.catalogue_versions,atlas_private.catalogue_entries,atlas_private.catalogue_heads from public,anon,authenticated,service_role;
revoke all on sequence atlas_private.catalogue_versions_generation_seq from public,anon,authenticated,service_role;

create function public.atlas_catalogue_write(p_action text,p_version uuid,p_edition text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v atlas_private.catalogue_versions%rowtype;
 e jsonb; m jsonb; lng text; np bigint; nc bigint; head_generation bigint;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Trusted catalogue worker required' using errcode='42501';
 end if;
 if p_version is null or p_action is null or p_action not in ('begin','put','checkpoint','publish','fail','state')
 or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4000000 then
  raise exception 'Invalid catalogue operation' using errcode='22023';
 end if;
 if p_action='begin' then
  if p_edition is null or p_edition !~ '^20[0-9]{2}$' then
   raise exception 'Invalid catalogue edition' using errcode='22023';
  end if;
  insert into atlas_private.catalogue_versions(id,edition) values(p_version,p_edition) on conflict(id) do nothing;
 end if;
 select * into v from atlas_private.catalogue_versions where id=p_version for update;
 if not found then raise exception 'Catalogue version not found' using errcode='P0002'; end if;
 if p_edition is not null and p_edition<>v.edition then
  raise exception 'Catalogue edition mismatch' using errcode='22023';
 end if;
 if p_action in ('put','checkpoint','publish','fail') and v.status<>'building' then
  raise exception 'Catalogue version is immutable or closed' using errcode='55000';
 end if;
 if p_action='put' then
  if jsonb_typeof(p_data->'entries') is distinct from 'array' then
   raise exception 'Catalogue entries must be an array' using errcode='22023';
  end if;
  if jsonb_array_length(p_data->'entries') not between 1 and 100 then
   raise exception 'Catalogue batch must contain 1-100 entries' using errcode='22023';
  end if;
  for e in select value from jsonb_array_elements(p_data->'entries') loop
   if jsonb_typeof(e) is distinct from 'object' or coalesce(e->>'lang','') not in ('nl','en')
   or coalesce(e->>'kind','') not in ('programme','course')
   or jsonb_typeof(e->'summary') is distinct from 'object' or jsonb_typeof(e->'document') is distinct from 'object'
   or octet_length((e->'summary')::text)>20000 or octet_length((e->'document')::text)>2000000 then
    raise exception 'Invalid catalogue entry' using errcode='22023';
   end if;
   if coalesce(e->>'path','') !~* ('^/'||(e->>'lang')||'/'||(e->>'kind')||'/'||v.edition||'/[A-Za-z0-9_-]+$')
   or (e->'document'->>'source') is distinct from ('https://catalogue.hanze.nl'||(e->>'path')) then
    raise exception 'Catalogue entry source mismatch' using errcode='22023';
   end if;
   if e->>'kind'='programme' and (jsonb_typeof(e->'document'->'modules') is distinct from 'array'
   or (e->'document'->>'edition') is distinct from v.edition) then
    raise exception 'Invalid programme document' using errcode='22023';
   end if;
   insert into atlas_private.catalogue_entries(version_id,lang,path,kind,summary,document)
   values(v.id,e->>'lang',e->>'path',e->>'kind',e->'summary',e->'document')
   on conflict(version_id,lang,path) do update set kind=excluded.kind,summary=excluded.summary,document=excluded.document;
  end loop;
 elsif p_action='checkpoint' then
  if octet_length(p_data::text)>1000000 then raise exception 'Checkpoint too large' using errcode='22023'; end if;
  update atlas_private.catalogue_versions set checkpoint=p_data where id=v.id;
 elsif p_action='fail' then
  update atlas_private.catalogue_versions set status='failed' where id=v.id;
 elsif p_action='publish' then
  if jsonb_typeof(p_data->'manifest') is distinct from 'object' then
   raise exception 'Bilingual manifest required' using errcode='22023';
  end if;
  m=p_data->'manifest';
  if not (m ?& array['nl','en']) or (select count(*) from jsonb_object_keys(m))<>2 then
   raise exception 'Both catalogue languages required' using errcode='22023';
  end if;
  foreach lng in array array['nl','en'] loop
   if jsonb_typeof(m->lng) is distinct from 'object'
   or (m->lng->>'programmes') is null or (m->lng->>'programmes') !~ '^[0-9]{1,6}$'
   or (m->lng->>'courses') is null or (m->lng->>'courses') !~ '^[0-9]{1,6}$'
   or (m->lng->>'listed_courses') is null or (m->lng->>'listed_courses') !~ '^[0-9]{1,6}$'
   or jsonb_typeof(m->lng->'clusters') is distinct from 'array' then
    raise exception 'Invalid language manifest' using errcode='22023';
   end if;
   select count(*) filter(where kind='programme'),count(*) filter(where kind='course') into np,nc
   from atlas_private.catalogue_entries where version_id=v.id and lang=lng;
   if np<>(m->lng->>'programmes')::bigint or nc<>(m->lng->>'courses')::bigint or np+nc=0
   or (m->lng->>'listed_courses')::bigint>nc then
    raise exception 'Incomplete catalogue counts' using errcode='22023';
   end if;
   if exists (
    select 1 from atlas_private.catalogue_entries p
    cross join lateral jsonb_array_elements(case when p.kind='programme' then p.document->'modules' else '[]'::jsonb end) module
    cross join lateral jsonb_array_elements(coalesce(module->'courses','[]')) course
    where p.version_id=v.id and p.lang=lng and p.kind='programme'
    and not exists(select 1 from atlas_private.catalogue_entries c where c.version_id=v.id and c.lang=lng and c.kind='course' and c.path=course->>'path')
   ) then raise exception 'Programme references a missing course' using errcode='22023'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('atlas-catalogue:'||v.edition,0));
  select old.generation into head_generation from atlas_private.catalogue_heads h
  join atlas_private.catalogue_versions old on old.id=h.version_id where h.edition=v.edition;
  if head_generation is not null and head_generation>v.generation then
   raise exception 'A newer catalogue is already published' using errcode='40001';
  end if;
  update atlas_private.catalogue_versions set status='published',manifest=m,published_at=now() where id=v.id;
  insert into atlas_private.catalogue_heads(edition,version_id) values(v.edition,v.id)
  on conflict(edition) do update set version_id=excluded.version_id;
 end if;
 if p_action<>'state' then update atlas_private.catalogue_versions set updated_at=now() where id=v.id; end if;
 select * into v from atlas_private.catalogue_versions where id=v.id;
 return jsonb_build_object('version',v.id,'edition',v.edition,'status',v.status,'checkpoint',v.checkpoint,'manifest',v.manifest,'published_at',v.published_at);
end;
$$;
revoke all on function public.atlas_catalogue_write(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_catalogue_write(text,uuid,text,jsonb) to service_role;

create function public.atlas_catalogue_read(
 p_edition text,p_lang text,p_path text default null,p_kind text default 'programme',
 p_offset integer default 0,p_limit integer default 100,p_query text default '',p_cluster text default '',p_version uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v atlas_private.catalogue_versions%rowtype; doc jsonb; result jsonb; n bigint; cluster_name text;
begin
 if not atlas_private.is_facilitator() then raise exception 'Facilitator approval required' using errcode='42501'; end if;
 if p_edition is null or p_edition !~ '^20[0-9]{2}$' or p_lang is null or p_lang not in ('nl','en')
 or p_kind is null or p_kind not in ('programme','course') or p_offset is null or p_offset<0
 or p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_query,''))>150 or length(coalesce(p_cluster,''))>200 then
  raise exception 'Invalid catalogue query' using errcode='22023';
 end if;
 if p_version is null then
  select cv.* into v from atlas_private.catalogue_heads h join atlas_private.catalogue_versions cv on cv.id=h.version_id where h.edition=p_edition;
 else select * into v from atlas_private.catalogue_versions where id=p_version and edition=p_edition and status='published';
 end if;
 if v.id is null then return jsonb_build_object('available',false,'complete',false,'results','[]'::jsonb,'total',0,'version',null,'nextOffset',null); end if;
 if p_path is not null then
  select document into doc from atlas_private.catalogue_entries where version_id=v.id and lang=p_lang and path=p_path;
  if not found then raise exception 'Catalogue entry not found' using errcode='P0002'; end if;
  return jsonb_build_object('available',true,'complete',true,'version',v.id,'saved',v.published_at,'data',doc);
 end if;
 select c->>'name' into cluster_name from jsonb_array_elements(v.manifest->p_lang->'clusters') c where c->>'id'=p_cluster limit 1;
 cluster_name=coalesce(cluster_name,p_cluster,'');
 with matched as (
  select path,summary from atlas_private.catalogue_entries where version_id=v.id and lang=p_lang and kind=p_kind
  and (coalesce(p_query,'')='' or position(lower(p_query) in lower(summary::text))>0)
  and (cluster_name='' or summary->>'cluster'=cluster_name or coalesce(summary->'clusters','[]') ? cluster_name)
 ), page as (select * from matched order by path limit p_limit offset p_offset)
 select (select count(*) from matched),coalesce((select jsonb_agg(summary||jsonb_build_object('path',path) order by path) from page),'[]') into n,result;
 return jsonb_build_object('available',true,'complete',true,'version',v.id,'year',v.edition,'lang',p_lang,'saved',v.published_at,
 'clusters',v.manifest->p_lang->'clusters','results',result,'total',n,'nextOffset',case when p_offset+p_limit<n then p_offset+p_limit else null end);
end;
$$;
revoke all on function public.atlas_catalogue_read(text,text,text,text,integer,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.atlas_catalogue_read(text,text,text,text,integer,integer,text,text,uuid) to authenticated;
