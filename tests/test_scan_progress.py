"""Scan model and workspace contracts using mocked Supabase transport, not a live database."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class ScanProgressTests(unittest.TestCase):
    def test_model(self):
        script = r"""
const assert=require('node:assert/strict');
const m=require(process.argv[1]);
const old={programme:'Legacy',modules:[],mappings:{x:{evidence:'keep'}},targets:{}};
const before=JSON.stringify(old);
assert.equal(m.progress(old.scanProcess).complete,0);
assert.equal(JSON.stringify(old),before);
let scan=m.updateScan(undefined,'statuses','framework','complete');
assert.equal(m.progress(scan).percent,14);
scan=m.updateScan(scan,'statuses','framework','in-progress');
assert.equal(m.progress(scan).complete,0);
for(const step of m.steps)scan=m.updateScan(scan,'statuses',step.id,'complete');
assert.equal(m.progress(scan).percent,100);
scan=m.updateScan(scan,'profile','analysis','Profiel <script>not markup</script>');
const copy=JSON.parse(JSON.stringify({...old,scanProcess:scan}));
assert.deepEqual(m.readScan(copy.scanProcess),scan);
assert.equal(copy.mappings.x.evidence,'keep');
assert.equal(old.scanProcess,undefined);
for(const bad of [null,[],{version:2,statuses:{},profile:{}},{version:1,statuses:{unknown:'complete'},profile:{}},{version:1,statuses:{framework:true},profile:{}},{version:1,statuses:{},profile:{sources:42}}])assert.throws(()=>m.readScan(bad));
assert.throws(()=>m.updateScan(scan,'profile','analysis','x'.repeat(20001)));
assert.throws(()=>m.updateScan(scan,'statuses','framework','yes'));
assert.equal(m.progress(m.updateScan(scan,'statuses','framework','not-started')).complete,6);
"""
        subprocess.run(['node','--check',str(ROOT/'static/facilitator.js')],check=True)
        subprocess.run(['node','-e',script,str(ROOT/'static/facilitator.js')],check=True)

    def test_supabase_save_reopen_export_and_conflict(self):
        from flask import Flask
        import atlas_supabase as store

        workspaces={}
        snapshots={}
        headers={'Authorization':'Bearer test-user-jwt'}
        class Result:
            def __init__(self,status,payload):
                self.status_code=status
                self.ok=200<=status<300
                self.payload=copy.deepcopy(payload)
            def json(self):
                return copy.deepcopy(self.payload)

        def remote(method,url,**kwargs):
            self.assertEqual(kwargs['headers']['Authorization'],headers['Authorization'])
            self.assertEqual(kwargs['headers']['apikey'],'sb_publishable_test')
            path=urlsplit(url).path
            if path=='/rest/v1/rpc/atlas_access':
                self.assertEqual(method,'POST')
                return Result(200,{'id':'test-user','email':'test@example.org','role':'facilitator'})
            if path=='/rest/v1/rpc/save_workspace':
                self.assertEqual(method,'POST')
                data=kwargs['json']
                ident=data['p_id'] or str(uuid.uuid4())
                existing=workspaces.get(ident)
                if existing and data['p_expected_revision']!=existing['revision']:
                    return Result(400,{'code':'40001','message':'Workspace revision conflict'})
                state=copy.deepcopy(data['p_state'])
                row={'id':ident,'state':state,'revision':existing['revision']+1 if existing else 1,'updated_at':'stamp','deleted_at':None,'purge_after':None}
                workspaces[ident]=row
                if data['p_finish']:
                    sid=str(uuid.uuid4())
                    snapshots[sid]={'id':sid,'workspace_id':ident,'title':state.get('sessionTitle','Review'),'state':copy.deepcopy(state),'created_at':'stamp'}
                return Result(200,{key:row[key] for key in ('id','revision','updated_at')})
            self.assertEqual(method,'GET')
            self.assertIn(path,('/rest/v1/workspaces','/rest/v1/workspace_sessions'))
            records=list((workspaces if path.endswith('/workspaces') else snapshots).values())
            params=kwargs['params']
            for key in ('id','workspace_id'):
                if key in params:
                    self.assertTrue(params[key].startswith('eq.'))
                    records=[row for row in records if row.get(key)==params[key][3:]]
            if params.get('deleted_at')=='is.null':
                records=[row for row in records if row.get('deleted_at') is None]
            offset=params.get('offset',0)
            return Result(200,records[offset:offset+params.get('limit',500)])

        env={'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'}
        with patch.dict(os.environ,env,clear=True),patch.object(store.requests,'request',side_effect=remote):
            app=Flask(__name__)
            store.install(app,{'ROOT':ROOT,'now':lambda:'stamp'})
            http=app.test_client()
            state={'programme':'A','modules':[],'mappings':{'keep':{'evidence':'unchanged'}},'targets':{},'scanProcess':{'version':1,'statuses':{'framework':'complete'},'profile':{'sources':'Profile 1','analysis':'Team analysis','implications':'Curriculum choice'}}}
            def post(path,data,status=200):
                response=http.post(path,headers=headers,json=data)
                self.assertEqual(response.status_code,status,response.get_json())
                return response.get_json()
            def get(path):
                response=http.get(path,headers=headers)
                self.assertEqual(response.status_code,200,response.get_json())
                return response.get_json()

            saved=post('/api/save',{'state':state,'finish':True})
            ident=saved['id']
            self.assertEqual(saved['revision'],1)
            loaded=get('/api/workspaces/'+ident)
            self.assertEqual(loaded['state'],state)
            self.assertEqual(len(loaded['sessions']),1)
            snapshot=loaded['sessions'][0]['id']
            backup=post('/api/workspaces/export',{'ids':[ident]})
            self.assertEqual(backup['format'],'compass-workspace-backup-v1')
            restored=json.loads(json.dumps(backup))['workspaces'][0]['state']
            self.assertEqual(restored,state)
            self.assertEqual(json.loads(backup['workspaces'][0]['sessions'][0]['state']),state)
            imported=post('/api/save',{'state':restored})
            self.assertNotEqual(imported['id'],ident)
            self.assertEqual(get('/api/workspaces/'+imported['id'])['state'],state)
            newer=copy.deepcopy(state)
            newer['programme']='A updated'
            updated=post('/api/save',{'id':ident,'revision':saved['revision'],'state':newer})
            self.assertEqual(updated['revision'],2)
            post('/api/save',{'id':ident,'revision':saved['revision'],'state':dict(state,programme='stale')},409)
            self.assertEqual(get('/api/workspaces/'+ident)['state'],newer)
            legacy=post('/api/save',{'state':{'programme':'Legacy','modules':[]}})
            self.assertNotIn('scanProcess',get('/api/workspaces/'+legacy['id'])['state'])
            self.assertEqual(get('/api/sessions/'+snapshot)['state'],state)

if __name__=='__main__':unittest.main()
