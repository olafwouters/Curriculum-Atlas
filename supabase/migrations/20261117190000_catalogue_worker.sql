-- Durable worker queue; apply separately after approval, after catalogue_storage.
create table atlas_private.catalogue_jobs (
 version_id uuid primary key references atlas_private.catalogue_versions(id),
 owner uuid, lease_until timestamptz, task jsonb,
 manifest jsonb not null default '{"nl":{"clusters":[]},"en":{"clusters":[]}}',
 last_error text
);
create table atlas_private.catalogue_tasks (
 version_id uuid not null references atlas_private.catalogue_jobs(version_id),
 lang text not null check(lang in ('nl','en')),
 kind text not null check(kind in ('indexProgramme','indexCourse','programme','course','verifyProgramme','verifyCourse')),
 path text not null, summary jsonb not null default '{}' check(jsonb_typeof(summary)='object'),
 done boolean not null default false,
 primary key(version_id,lang,kind,path)
);
create index catalogue_tasks_pending on atlas_private.catalogue_tasks(version_id,lang,kind,path) where not done;
alter table atlas_private.catalogue_jobs enable row level security;
alter table atlas_private.catalogue_tasks enable row level security;
revoke all on atlas_private.catalogue_jobs,atlas_private.catalogue_tasks from public,anon,authenticated,service_role;
create function public.atlas_catalogue_job(p_action text,p_version uuid,p_owner uuid,p_year text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v atlas_private.catalogue_versions%rowtype; j atlas_private.catalogue_jobs%rowtype;
 t atlas_private.catalogue_tasks%rowtype; e jsonb; c jsonb; doc jsonb; result jsonb;
 k text; lng text; n bigint; digest text; clusters jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Trusted worker required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('start','status','claim','heartbeat','reset_index','enqueue','index_done','finish','verify','publish','release')
 or p_version is null or p_owner is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4000000 then
  raise exception 'Invalid worker operation' using errcode='22023';
 end if;
 if p_action='start' then perform public.atlas_catalogue_write('begin',p_version,p_year); end if;
 select * into v from atlas_private.catalogue_versions where id=p_version for update;
 if not found then raise exception 'Version not found' using errcode='P0002'; end if;
 if p_year is not null and p_year<>v.edition then raise exception 'Edition mismatch' using errcode='22023'; end if;
 if v.status<>'building' then
  if p_action not in ('start','status') then raise exception 'Version closed' using errcode='55000'; end if;
  return jsonb_build_object('version',v.id,'status',v.status);
 end if;
 if p_action='start' then
  insert into atlas_private.catalogue_jobs(version_id) values(v.id) on conflict do nothing;
  insert into atlas_private.catalogue_tasks(version_id,lang,kind,path)
  select v.id,langs.lang,kinds.kind,kinds.kind from unnest(array['nl','en']) langs(lang) cross join unnest(array['indexProgramme','indexCourse','verifyProgramme','verifyCourse']) kinds(kind) on conflict do nothing;
 end if;
 select * into j from atlas_private.catalogue_jobs where version_id=v.id for update;
 if not found then raise exception 'Worker job not found' using errcode='P0002'; end if;
 if p_action='claim' then
  if j.owner is not null and j.owner<>p_owner and j.lease_until>clock_timestamp() then raise exception 'Worker busy' using errcode='55P03'; end if;
  select * into t from atlas_private.catalogue_tasks where version_id=v.id and not done
  order by case when kind like 'index%' then 0 when kind='programme' then 1 when kind='course' then 2 else 3 end,lang,kind,path limit 1;
  result=case when t.path is null then null else jsonb_build_object('lang',t.lang,'kind',t.kind,'path',t.path,'summary',t.summary) end;
  update atlas_private.catalogue_jobs set owner=p_owner,lease_until=clock_timestamp()+interval '120 seconds',task=result,last_error=null where version_id=v.id;
  return jsonb_build_object('version',v.id,'status',v.status,'task',result);
 end if;
 if p_action not in ('start','status') then
  if j.owner is distinct from p_owner or j.lease_until is null or j.lease_until<=clock_timestamp() then raise exception 'Worker lease lost' using errcode='55P03'; end if;
  lng=j.task->>'lang'; k=case when j.task->>'kind' in ('indexProgramme','verifyProgramme') then 'programme' else 'course' end;
  if p_action in ('reset_index','enqueue','index_done') and coalesce(j.task->>'kind','') not in ('indexProgramme','indexCourse') then raise exception 'Index task required' using errcode='55000'; end if;
  if p_action='reset_index' then
   delete from atlas_private.catalogue_tasks where version_id=v.id and lang=lng and kind=k and not done;
  elsif p_action='enqueue' then
   if jsonb_typeof(p_data->'rows') is distinct from 'array' then raise exception 'Rows required' using errcode='22023'; end if;
   if jsonb_array_length(p_data->'rows') not between 1 and 100 then raise exception 'Batch size invalid' using errcode='22023'; end if;
   for e in select value from jsonb_array_elements(p_data->'rows') loop
    if jsonb_typeof(e) is distinct from 'object' or octet_length(e::text)>20000 or coalesce(e->>'path','') !~* ('^/'||lng||'/'||k||'/'||v.edition||'/[A-Za-z0-9_-]+$') then raise exception 'Invalid queued source' using errcode='22023'; end if;
    insert into atlas_private.catalogue_tasks values(v.id,lng,k,e->>'path',e,false) on conflict do nothing;
   end loop;
  elsif p_action='index_done' then
   select count(*),md5(coalesce(string_agg(path,E'\n' order by path collate "C"),'')) into n,digest from atlas_private.catalogue_tasks where version_id=v.id and lang=lng and kind=k;
   if (p_data->>'count') is null or (p_data->>'count') !~ '^[0-9]{1,6}$' or n<>(p_data->>'count')::bigint or jsonb_typeof(p_data->'clusters') is distinct from 'array' then raise exception 'Incomplete index' using errcode='22023'; end if;
   select coalesce(jsonb_agg(x),'[]') into clusters from (select distinct on (x->>'id') x from jsonb_array_elements((j.manifest->lng->'clusters')||(p_data->'clusters')) x order by x->>'id',x::text) options;
   update atlas_private.catalogue_jobs set manifest=jsonb_set(jsonb_set(manifest,array[lng,case when k='programme' then 'programmes' else 'listed_courses' end],to_jsonb(n)),array[lng,'clusters'],clusters) where version_id=v.id;
   update atlas_private.catalogue_tasks set summary=jsonb_build_object('count',n,'digest',digest) where version_id=v.id and lang=lng and kind=case when k='programme' then 'verifyProgramme' else 'verifyCourse' end;
  elsif p_action='finish' then
   if coalesce(j.task->>'kind','') not in ('programme','course') then raise exception 'Detail task required' using errcode='55000'; end if;
   doc=p_data->'document';
   perform public.atlas_catalogue_write('put',v.id,null,jsonb_build_object('entries',jsonb_build_array(jsonb_build_object('lang',lng,'kind',j.task->>'kind','path',j.task->>'path','summary',j.task->'summary','document',doc))));
   if j.task->>'kind'='programme' then
    for c in select course.value from jsonb_array_elements(doc->'modules') m cross join lateral jsonb_array_elements(m->'courses') course loop
     if coalesce(c->>'path','') !~* ('^/'||lng||'/course/'||v.edition||'/[A-Za-z0-9_-]+$') then raise exception 'Invalid linked course' using errcode='22023'; end if;
     e=jsonb_build_object('path',c->>'path','name',concat_ws(' ',c->>'code',c->>'name'),'cluster',j.task->'summary'->>'cluster');
     insert into atlas_private.catalogue_tasks values(v.id,lng,'course',c->>'path',e,false) on conflict do nothing;
    end loop;
   end if;
  elsif p_action='verify' then
   if coalesce(j.task->>'kind','') not in ('verifyProgramme','verifyCourse') or (p_data->>'count') is distinct from (j.task->'summary'->>'count') or (p_data->>'digest') is distinct from (j.task->'summary'->>'digest') then raise exception 'Source index changed; start a new version' using errcode='22023'; end if;
  elsif p_action='publish' then
   if exists(select 1 from atlas_private.catalogue_tasks where version_id=v.id and not done) then raise exception 'Unfinished tasks' using errcode='55000'; end if;
   foreach lng in array array['nl','en'] loop
    select count(*) into n from atlas_private.catalogue_tasks where version_id=v.id and lang=lng and kind='course';
    j.manifest=jsonb_set(j.manifest,array[lng,'courses'],to_jsonb(n));
   end loop;
   result=public.atlas_catalogue_write('publish',v.id,null,jsonb_build_object('manifest',j.manifest));
   update atlas_private.catalogue_jobs set owner=null,lease_until=null,task=null where version_id=v.id;
   return result;
  elsif p_action='release' then
   update atlas_private.catalogue_jobs set owner=null,lease_until=null,task=null,last_error=case when p_data->>'error'='true' then 'Update paused after an error; resume this version or start a new version.' else null end where version_id=v.id;
  end if;
  if p_action in ('index_done','finish','verify') then
   update atlas_private.catalogue_tasks set done=true where version_id=v.id and lang=j.task->>'lang' and kind=j.task->>'kind' and path=j.task->>'path';
   update atlas_private.catalogue_jobs set task=null where version_id=v.id;
  end if;
  if p_action<>'release' then update atlas_private.catalogue_jobs set lease_until=clock_timestamp()+interval '120 seconds' where version_id=v.id; end if;
  update atlas_private.catalogue_versions set updated_at=clock_timestamp() where id=v.id;
 end if;
 select jsonb_build_object('version',v.id,'status',v.status,'done',count(*) filter(where done),'total',count(*),'last_error',(select last_error from atlas_private.catalogue_jobs where version_id=v.id)) into result from atlas_private.catalogue_tasks where version_id=v.id;
 return result;
end;
$$;
revoke all on function public.atlas_catalogue_job(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_catalogue_job(text,uuid,uuid,text,jsonb) to service_role;
