"""Offline scan contracts: Node model and actual SQLite route functions (no HTTP server)."""
import ast
import datetime
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]

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

    def test_sqlite_save_reopen_export_and_conflict(self):
        tree=ast.parse((ROOT/'server.py').read_text(encoding='utf-8'))
        names={'save','load','export_workspaces','session'}
        nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
        self.assertEqual(len(nodes),4)
        for node in nodes:node.decorator_list=[]
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'isolated.sqlite3'
            def db():
                con=sqlite3.connect(path);con.row_factory=sqlite3.Row;return con
            with db() as con:
                con.executescript('CREATE TABLE workspaces(id TEXT PRIMARY KEY,state TEXT,revision INTEGER,updated TEXT); CREATE TABLE sessions(id TEXT PRIMARY KEY,workspace TEXT,title TEXT,state TEXT,created TEXT);')
            request=SimpleNamespace(json={})
            env={'request':request,'db':db,'jsonify':lambda *a,**kw:a[0] if a else kw,'json':json,'uuid':uuid,'now':lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()}
            exec(compile(ast.Module(body=nodes,type_ignores=[]),'<workspace routes>','exec'),env)
            state={'programme':'A','modules':[],'mappings':{'keep':{'evidence':'unchanged'}},'targets':{},'scanProcess':{'version':1,'statuses':{'framework':'complete'},'profile':{'sources':'Profile 1','analysis':'Team analysis','implications':'Curriculum choice'}}}
            request.json={'state':state,'finish':True}
            saved=env['save']();ident=saved['id']
            self.assertEqual(env['load'](ident)['state'],state)
            request.json={'ids':[ident]}
            backup=env['export_workspaces']()
            restored=json.loads(json.dumps(backup))['workspaces'][0]['state']
            self.assertEqual(restored,state)
            request.json={'state':restored}
            imported=env['save']()
            self.assertNotEqual(imported['id'],ident)
            self.assertEqual(env['load'](imported['id'])['state'],state)
            request.json={'id':ident,'revision':0,'state':dict(state,programme='stale')}
            self.assertEqual(env['save']()[1],409)
            self.assertEqual(env['load'](ident)['state'],state)
            request.json={'state':{'programme':'Legacy','modules':[]}}
            legacy=env['save']()
            self.assertNotIn('scanProcess',env['load'](legacy['id'])['state'])
            with db() as con:snapshot=con.execute('SELECT id FROM sessions WHERE workspace=?',(ident,)).fetchone()['id']
            self.assertEqual(env['session'](snapshot)['state'],state)

if __name__=='__main__':unittest.main()
