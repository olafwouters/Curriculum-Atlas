"""User-scoped Supabase integration. No SQLite fallback or elevated API key."""
import json,os,uuid,requests
from flask import request,jsonify,g,Response
from werkzeug.exceptions import HTTPException
class StoreError(Exception):
 def __init__(self,message,status=503):self.status=status;super().__init__(message)
def configuration():
 url=os.environ.get('SUPABASE_URL','').rstrip('/');key=os.environ.get('SUPABASE_PUBLISHABLE_KEY','')
 if not url.startswith('https://') or not key.startswith('sb_publishable_'):raise StoreError('Supabase configuration missing; local fallback is disabled.')
 return url,key
def remote(path,method='GET',data=None,params=None):
 url,key=configuration()
 try:r=requests.request(method,url+path,headers={'apikey':key,'Authorization':'Bearer '+g.atlas_token,'Content-Type':'application/json'},json=data,params=params,timeout=(5,15),allow_redirects=False)
 except requests.RequestException:raise StoreError('Database unreachable; operation not confirmed. Export JSON before retrying.')
 try:result=r.json()
 except ValueError:raise StoreError('Invalid database response; operation not confirmed.')
 if not r.ok:
  code=result.get('code','') if isinstance(result,dict) else ''
  status={'40001':409,'23505':409,'P0002':404,'55000':409,'42501':403,'22023':400,'22P02':400,'23514':400}.get(code) or (r.status_code if r.status_code in (400,401,403,404,409,413,429) else 503)
  message=result.get('message') if isinstance(result,dict) else None
  raise StoreError(message if message and status in (400,403,404,409) else 'Authentication or database request failed; operation not confirmed.',status)
 return result
def rpc(name,**args):return remote('/rest/v1/rpc/'+name,'POST',args)
def rows(table,**params):
 out=[]
 for offset in range(0,100000,500):
  batch=remote('/rest/v1/'+table,params={**params,'limit':500,'offset':offset})
  if not isinstance(batch,list):raise StoreError('Unexpected database result.')
  out.extend(batch)
  if len(batch)<500:return out
 raise StoreError('Result too large; use a scoped export.')
def ident(value):
 try:return str(uuid.UUID(str(value)))
 except (ValueError,TypeError,AttributeError):raise StoreError('Invalid workspace identifier.',400)
def revision(value):
 if type(value) is not int or value<1:raise StoreError('Current revision required.',400)
 return value
def install(app,legacy):
 def route(path,fn,method='GET'):app.add_url_rule(path,'atlas_'+fn.__name__,fn,methods=[method])
 @app.errorhandler(StoreError)
 def storage_error(e):return jsonify(error=str(e)),e.status
 @app.errorhandler(HTTPException)
 def http_error(e):return jsonify(error=e.description),e.code
 @app.after_request
 def no_cache(response):
  if request.path.startswith('/api/'):response.headers['Cache-Control']='private, no-store';response.headers['Vary']='Authorization'
  return response
 @app.before_request
 def authenticate():
  if not request.path.startswith('/api/') or request.path=='/api/auth/config':return
  configuration();bearer=request.headers.get('Authorization','')
  if not bearer.startswith('Bearer ') or len(bearer)>16384:raise StoreError('Approved facilitator sign-in required.',401)
  g.atlas_token=bearer[7:];g.atlas_access=rpc('atlas_access')
  if request.method not in ('GET','HEAD','OPTIONS'):
   origin=request.headers.get('Origin')
   if origin and origin!=os.environ.get('APP_ORIGIN',request.host_url.rstrip('/')):raise StoreError('Cross-origin write refused.',403)
  if request.path in ('/api/catalogue-cache/start','/api/catalogue-cache/stop'):raise StoreError('Use the separate catalogue synchronisation worker; request-lifetime crawling is disabled.',503)
  if os.environ.get('VERCEL') and request.path in ('/api/search','/api/catalogue-clusters','/api/programme','/api/course'):raise StoreError('Persistent catalogue integration is not installed yet. Workspace storage is available.',503)
 def home():
  html=(legacy['ROOT']/'static/index.html').read_text(encoding='utf-8');marker='<script src="/static/app.js'
  if html.count(marker)!=1:raise StoreError('Application boot marker changed; cannot install authentication safely.')
  assets='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js"></script><script src="/static/atlas-auth.js?v=20261117"></script>'
  return Response(html.replace(marker,assets+marker,1),mimetype='text/html')
 app.view_functions['home']=home
 def config():
  url,key=configuration();return jsonify(url=url,publishableKey=key)
 route('/api/auth/config',config)
 def me():return jsonify(g.atlas_access)
 route('/api/auth/me',me)
 def workspace(value,deleted=False):
  params={'id':'eq.'+ident(value),'select':'*','order':'id.asc'}
  if not deleted:params['deleted_at']='is.null'
  found=rows('workspaces',**params)
  if not found:raise StoreError('Workspace not found.',404)
  return found[0]
 legacy['load_workspace_state']=lambda value:workspace(value)['state']
 def snapshots(value):return rows('workspace_sessions',workspace_id='eq.'+ident(value),select='*',order='created_at.desc,id.asc')
 def listing():
  deleted=request.args.get('deleted')=='1';out=[]
  for w in rows('workspaces',select='*',deleted_at='not.is.null' if deleted else 'is.null',order='updated_at.desc,id.asc'):
   st=w['state'];arch=bool(st.get('archived'))
   if arch and not deleted and request.args.get('all')!='1':continue
   out.append(dict(id=w['id'],name=str(st.get('programme',''))+(' ('+str(st['edition'])+')' if st.get('edition') else ''),programme=st.get('programme'),edition=st.get('edition'),updated=w['updated_at'],revision=w['revision'],archived=arch,deleted_at=w['deleted_at'],purge_after=w['purge_after']))
  return jsonify(out)
 route('/api/workspaces',listing)
 def load(value):
  w=workspace(value);return jsonify(id=w['id'],state=w['state'],revision=w['revision'],sessions=[dict(id=s['id'],title=s['title'],created=s['created_at']) for s in snapshots(value)])
 route('/api/workspaces/<value>',load)
 def save():
  d=request.get_json() or {};value=ident(d['id']) if d.get('id') else None
  w=rpc('save_workspace',p_state=d.get('state'),p_id=value,p_expected_revision=revision(d.get('revision')) if value else None,p_finish=d.get('finish') is True)
  return jsonify(id=w['id'],revision=w['revision'],updated=w['updated_at'])
 route('/api/save',save,'POST')
 def session(value):
  found=rows('workspace_sessions',id='eq.'+ident(value),select='state',order='id.asc')
  if not found:raise StoreError('Session not found.',404)
  return jsonify(state=found[0]['state'])
 route('/api/sessions/<value>',session)
 def selected(data):
  items=data.get('workspaces')
  if not isinstance(items,list) or not 1<=len(items)<=1000:raise StoreError('Select 1-1000 workspaces.',400)
  result=[{'id':ident(x.get('id')),'revision':revision(x.get('revision'))} for x in items if isinstance(x,dict)]
  if len(result)!=len(items) or len({x['id'] for x in result})!=len(result):raise StoreError('Invalid or duplicate selection.',400)
  return result
 def delete():
  d=request.get_json() or {}
  if d.get('confirmed') is not True:raise StoreError('Confirm deletion first.',400)
  result=rpc('atlas_workspace_batch',p_items=selected(d),p_action='delete');return jsonify(deleted=result['count'],recoverable=True,retentionDays=30)
 route('/api/workspaces/delete',delete,'POST')
 def restore():
  result=rpc('atlas_workspace_batch',p_items=selected(request.get_json() or {}),p_action='restore');return jsonify(restored=result['count'])
 route('/api/workspaces/restore',restore,'POST')
 def archive():
  d=request.get_json() or {};flag=d.get('archived',True) is True
  result=rpc('atlas_workspace_batch',p_items=selected(d),p_action='archive' if flag else 'unarchive');return jsonify(count=result['count'],archived=flag)
 route('/api/workspaces/archive',archive,'POST')
 def export():
  ids=(request.get_json() or {}).get('ids')
  if not isinstance(ids,list) or not 1<=len(ids)<=1000:raise StoreError('Select workspaces to export.',400)
  out=[]
  for value in dict.fromkeys(ident(x) for x in ids):
   w=workspace(value,True);ss=snapshots(value)
   if workspace(value,True)['revision']!=w['revision']:raise StoreError('Workspace changed during export; try again.',409)
   out.append(dict(id=value,revision=w['revision'],updated=w['updated_at'],state=w['state'],sessions=[dict(id=s['id'],workspace=value,title=s['title'],state=json.dumps(s['state'],ensure_ascii=False),created=s['created_at']) for s in ss]))
  return jsonify(format='compass-workspace-backup-v1',exported=legacy['now'](),workspaces=out)
 route('/api/workspaces/export',export,'POST')
 def copy_year():
  d=request.get_json() or {};w=workspace(d.get('workspace'));new,_=legacy['structure_for'](d.get('path',''))
  ns,report=legacy['build_plan'](w['state'],new,w['id'],d.get('lang','nl'));ns.pop('archived',None);ns.pop('archivedAt',None)
  value=rpc('atlas_copy_workspace',p_source=w['id'],p_expected_revision=revision(d.get('revision')),p_state=ns,p_archive=d.get('archive',True) is True)
  return jsonify(id=value,name=str(ns.get('programme'))+' ('+str(ns.get('edition'))+')',summary=report['summary'],archived=d.get('archive',True) is True)
 route('/api/year-copy/commit',copy_year,'POST')
 def shared(kind):return rows('shared_items',kind='eq.'+kind,select='*',order='id.asc')
 def sets_list():return jsonify([dict(x['data'],id=x['id'],updated=x['updated_at'],revision=x['revision']) for x in shared('competence_set') if not x['deleted']])
 route('/api/competence-sets',sets_list)
 def sets_save():
  d=request.get_json() or {};name,out=legacy['cs_clean'](d)
  r=rpc('atlas_write_shared',p_kind='competence_set',p_id=str(d.get('id') or uuid.uuid4()),p_data={'name':name,'outcomes':out},p_delete=False,p_expected_revision=d.get('revision'));return jsonify(id=r['id'],name=name)
 route('/api/competence-sets',sets_save,'POST')
 def sets_delete():
  d=request.get_json() or {};rpc('atlas_write_shared',p_kind='competence_set',p_id=str(d.get('id','')),p_data=None,p_delete=True,p_expected_revision=d.get('revision'));return jsonify(deleted=1)
 route('/api/competence-sets/delete',sets_delete,'POST')
 def library_list():
  seed={x['id']:dict(x,source='curated') for x in legacy['lib_seeds']()}
  for x in shared('library'):
   seed.pop(x['id'],None)
   if not x['deleted']:seed[x['id']]=dict(x['data'],id=x['id'],revision=x['revision'],created=x['created_at'],updated=x['updated_at'])
  return jsonify(list(seed.values()))
 route('/api/library',library_list)
 def library_write(update=False):
  d=request.get_json() or {};data=legacy['lib_clean'](d.get('item'));value=str(d.get('id','')) if update else str(uuid.uuid4())
  data['source']='curated' if any(x['id']==value for x in legacy['lib_seeds']()) else 'handmatig'
  rpc('atlas_write_shared',p_kind='library',p_id=value,p_data=data,p_delete=False,p_expected_revision=d.get('revision'));return jsonify(ok=True,id=value)
 def library_add():return library_write()
 def library_update():return library_write(True)
 def library_delete():
  d=request.get_json() or {};rpc('atlas_write_shared',p_kind='library',p_id=str(d.get('id','')),p_data=None,p_delete=True,p_expected_revision=d.get('revision'));return jsonify(deleted=1)
 route('/api/library',library_add,'POST');route('/api/library/update',library_update,'POST');route('/api/library/delete',library_delete,'POST')
