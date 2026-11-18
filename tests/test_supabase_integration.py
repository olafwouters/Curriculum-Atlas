import os,sys,unittest,uuid
from pathlib import Path
from unittest.mock import patch
from flask import Flask
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import atlas_supabase as store
class IntegrationTests(unittest.TestCase):
 def setUp(self):
  self.env=patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'},clear=True);self.env.start()
  self.app=Flask(__name__);store.install(self.app,{'now':lambda:'stamp','ROOT':Path('.'),'lib_seeds':lambda:[]})
  self.http=self.app.test_client();self.headers={'Authorization':'Bearer user-jwt'};self.wid=str(uuid.uuid4())
 def tearDown(self):self.env.stop()
 def access(self,name,**kw):
  if name=='atlas_access':return {'id':'u1','email':'a@example.org','role':'facilitator'}
  raise AssertionError(name)
 def test_public_config_has_only_public_values(self):self.assertEqual(set(self.http.get('/api/auth/config').json),{'url','publishableKey'})
 def test_anonymous_denied(self):
  for path in ['/api/workspaces','/api/library','/api/competence-sets','/api/auth/me']:self.assertEqual(self.http.get(path).status_code,401)
 def test_missing_config_closed(self):
  with patch.dict(os.environ,{},clear=True):self.assertEqual(self.http.get('/api/workspaces',headers=self.headers).status_code,503)
 def test_unapproved_denied(self):
  with patch.object(store,'rpc',side_effect=store.StoreError('Denied',403)):self.assertEqual(self.http.get('/api/workspaces',headers=self.headers).status_code,403)
 def test_save_shape_and_revision(self):
  def fake(name,**a):
   if name=='atlas_access':return self.access(name)
   self.assertEqual(a['p_expected_revision'],4);return {'id':self.wid,'revision':5,'updated_at':'stamp'}
  with patch.object(store,'rpc',side_effect=fake):
   r=self.http.post('/api/save',headers=self.headers,json={'id':self.wid,'revision':4,'state':{'programme':'Test','modules':[]}});self.assertEqual(r.status_code,200);self.assertEqual(r.json['revision'],5)
 def test_revision_required(self):
  with patch.object(store,'rpc',side_effect=self.access):self.assertEqual(self.http.post('/api/save',headers=self.headers,json={'id':self.wid,'state':{}}).status_code,400)
 def test_restore_batch(self):
  def fake(name,**a):
   if name=='atlas_access':return self.access(name)
   self.assertEqual(a['p_action'],'restore');return {'count':1}
  with patch.object(store,'rpc',side_effect=fake):self.assertEqual(self.http.post('/api/workspaces/restore',headers=self.headers,json={'workspaces':[{'id':self.wid,'revision':3}]}).json,{'restored':1})
 def test_delete_requires_confirmation(self):
  with patch.object(store,'rpc',side_effect=self.access):self.assertEqual(self.http.post('/api/workspaces/delete',headers=self.headers,json={}).status_code,400)
 def test_cross_origin_write_denied(self):
  with patch.object(store,'rpc',side_effect=self.access):self.assertEqual(self.http.post('/api/save',headers={**self.headers,'Origin':'https://evil.example'},json={}).status_code,403)
 def test_pagination(self):
  with patch.object(store,'remote',side_effect=[[{}]*500,[{}]*2]):self.assertEqual(len(store.rows('workspaces')),502)
 def test_conflict_mapping_and_token(self):
  class Result:
   ok=False;status_code=400
   def json(self):return {'code':'40001','message':'Conflict'}
  with self.app.test_request_context('/'),patch.object(store.requests,'request',return_value=Result()) as call:
   store.g.atlas_token='user-jwt'
   with self.assertRaises(store.StoreError) as e:store.remote('/rest/v1/rpc/save_workspace','POST',{})
   self.assertEqual(e.exception.status,409);self.assertEqual(call.call_args.kwargs['headers']['Authorization'],'Bearer user-jwt')
if __name__=='__main__':unittest.main()
