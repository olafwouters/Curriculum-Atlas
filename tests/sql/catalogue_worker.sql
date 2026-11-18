-- Disposable SQL CI only; source requests are represented by deterministic fixtures.
do $$ begin if current_database() is distinct from 'catalogue_ci' then raise exception 'CI database required'; end if; end $$;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
do $$ declare
 v uuid='10000000-0000-0000-0000-000000000010';
 owner_id uuid='20000000-0000-0000-0000-000000000001';
 other_id uuid='20000000-0000-0000-0000-000000000002';
 task jsonb; r jsonb; path text; document jsonb;
begin
 perform public.atlas_catalogue_job('start',v,owner_id,'2026');
 perform public.atlas_catalogue_job('claim',v,owner_id);
 begin
  perform public.atlas_catalogue_job('claim',v,other_id);
  raise exception 'Concurrent worker acquired active lease';
 exception when lock_not_available then null; end;
 begin
  perform public.atlas_catalogue_job('publish',v,owner_id);
  raise exception 'Partial catalogue published';
 exception when object_not_in_prerequisite_state then null; end;
 perform public.atlas_catalogue_job('release',v,owner_id);
 for i in 1..20 loop
  r=public.atlas_catalogue_job('claim',v,other_id);task=r->'task';
  if task='null'::jsonb then exit; end if;
  if task->>'kind' like 'index%' then
   path='/'||(task->>'lang')||case when task->>'kind'='indexProgramme' then '/Programme/2026/P' else '/course/2026/UNLINKED' end;
   perform public.atlas_catalogue_job('reset_index',v,other_id);
   perform public.atlas_catalogue_job('enqueue',v,other_id,null,jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('path',path,'name','Fixture'))));
   perform public.atlas_catalogue_job('index_done',v,other_id,null,'{"count":1,"clusters":[]}');
  elsif task->>'kind' like 'verify%' then
   begin
    perform public.atlas_catalogue_job('verify',v,other_id,null,jsonb_build_object('count',1,'digest','changed'));
    raise exception 'Changed index accepted';
   exception when invalid_parameter_value then null; end;
   perform public.atlas_catalogue_job('verify',v,other_id,null,task->'summary');
  else
   document=jsonb_build_object('edition','2026','source','https://catalogue.hanze.nl'||(task->>'path'));
   if task->>'kind'='programme' then document=document||jsonb_build_object('modules',jsonb_build_array(jsonb_build_object('courses',jsonb_build_array(jsonb_build_object('path','/'||(task->>'lang')||'/course/2026/LINKED','name','Linked'))))); end if;
   perform public.atlas_catalogue_job('finish',v,other_id,null,jsonb_build_object('document',document));
  end if;
 end loop;
 r=public.atlas_catalogue_job('publish',v,other_id);
 if r->>'status' is distinct from 'published' or r->'manifest'->'en'->>'courses' is distinct from '2' then raise exception 'Bilingual linked/unlinked catalogue incomplete'; end if;
 r=public.atlas_catalogue_job('start',v,other_id,'2026');
 if r->>'status' is distinct from 'published' then raise exception 'Published job did not remain closed'; end if;
end $$;
reset role;
set role authenticated;
do $$ begin
 begin
  perform public.atlas_catalogue_job('status','10000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001');
  raise exception 'User could execute worker RPC';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
