-- Disposable CI database ONLY. Exercises actual SQL functions and role permissions.
do $$ begin if current_database() is distinct from 'catalogue_ci' then raise exception 'CI database required'; end if; end $$;
insert into auth.users(id,email,email_confirmed_at)
select '00000000-0000-0000-0000-000000000001',email,now() from atlas_private.facilitator_access limit 1;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
select public.atlas_catalogue_write('begin','10000000-0000-0000-0000-000000000001','2026');
select public.atlas_catalogue_write('checkpoint','10000000-0000-0000-0000-000000000001',null,'{"phase":"courses"}');
select public.atlas_catalogue_write('put','10000000-0000-0000-0000-000000000001',null,
'{"entries":[{"lang":"nl","path":"/nl/course/2026/A","kind":"course","summary":{"name":"Dutch A"},"document":{"source":"https://catalogue.hanze.nl/nl/course/2026/A"}},{"lang":"en","path":"/en/course/2026/A","kind":"course","summary":{"name":"English A"},"document":{"source":"https://catalogue.hanze.nl/en/course/2026/A"}}]}');
do $$ begin
 begin
  perform public.atlas_catalogue_write('publish','10000000-0000-0000-0000-000000000001',null,'{"manifest":{"nl":{"programmes":0,"courses":1,"listed_courses":1,"clusters":[]}}}');
  raise exception 'Single-language publication accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select public.atlas_catalogue_write('publish','10000000-0000-0000-0000-000000000001',null,
'{"manifest":{"nl":{"programmes":0,"courses":1,"listed_courses":1,"clusters":[]},"en":{"programmes":0,"courses":1,"listed_courses":1,"clusters":[]}}}');
do $$ begin
 begin
  perform public.atlas_catalogue_write('put','10000000-0000-0000-0000-000000000001',null,'{"entries":[]}');
  raise exception 'Published version was writable';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
select public.atlas_catalogue_write('begin','10000000-0000-0000-0000-000000000002','2026');
select public.atlas_catalogue_write('fail','10000000-0000-0000-0000-000000000002');
reset role;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
 r=public.atlas_catalogue_read('2026','nl',p_kind=>'course');
 if r->>'version' is distinct from '10000000-0000-0000-0000-000000000001' or r->>'total' is distinct from '1' or r->'results'->0->>'name' is distinct from 'Dutch A' then raise exception 'Saved Dutch catalogue unavailable after failed update'; end if;
 r=public.atlas_catalogue_read('2026','en',p_kind=>'course');
 if r->'results'->0->>'name' is distinct from 'English A' then raise exception 'Language isolation failed'; end if;
 r=public.atlas_catalogue_read('2026','nl',p_path=>'/nl/course/2026/A');
 if r->'data'->>'source' is distinct from 'https://catalogue.hanze.nl/nl/course/2026/A' then raise exception 'Detail read failed'; end if;
 r=public.atlas_catalogue_read('2027','nl');
 if r->>'available' is distinct from 'false' then raise exception 'Missing catalogue incorrectly available'; end if;
 begin
  perform public.atlas_catalogue_write('begin','10000000-0000-0000-0000-000000000003','2026');
  raise exception 'Facilitator could publish';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from atlas_private.catalogue_entries;
  raise exception 'Direct table read permitted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);
do $$ begin
 begin
  perform public.atlas_catalogue_read('2026','nl');
  raise exception 'Unapproved user could read catalogue';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform public.atlas_catalogue_read('2026','nl');
  raise exception 'Anonymous catalogue access permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
do $$ declare id uuid; payload jsonb; manifest jsonb; begin
 manifest='{"manifest":{"nl":{"programmes":0,"courses":1,"listed_courses":1,"clusters":[]},"en":{"programmes":0,"courses":1,"listed_courses":1,"clusters":[]}}}';
 select jsonb_build_object('entries',jsonb_agg(jsonb_build_object('lang',lang,'kind','course','path','/'||lang||'/course/2026/B','summary',jsonb_build_object('name',lang||' B'),'document',jsonb_build_object('source','https://catalogue.hanze.nl/'||lang||'/course/2026/B')))) into payload from (values('nl'),('en')) langs(lang);
 foreach id in array array['10000000-0000-0000-0000-000000000004'::uuid,'10000000-0000-0000-0000-000000000005'::uuid] loop
  perform public.atlas_catalogue_write('begin',id,'2026');
  perform public.atlas_catalogue_write('put',id,null,payload);
 end loop;
 perform public.atlas_catalogue_write('publish','10000000-0000-0000-0000-000000000005',null,manifest);
 begin
  perform public.atlas_catalogue_write('publish','10000000-0000-0000-0000-000000000004',null,manifest);
  raise exception 'Stale catalogue replaced newer version';
 exception when serialization_failure then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ declare r jsonb; begin
 r=public.atlas_catalogue_read('2026','nl',p_kind=>'course',p_version=>'10000000-0000-0000-0000-000000000001');
 if r->'results'->0->>'name' is distinct from 'Dutch A' then raise exception 'Pinned previous version was lost'; end if;
 r=public.atlas_catalogue_read('2026','nl',p_kind=>'course');
 if r->>'version' is distinct from '10000000-0000-0000-0000-000000000005' then raise exception 'Active catalogue pointer incorrect'; end if;
end $$;
reset role;
