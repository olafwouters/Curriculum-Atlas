"""Trusted standalone catalogue worker. No Flask imports or request-lifetime jobs."""
import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import signal
import time
import uuid
import requests

class WorkerError(Exception):
    pass

class WorkerRPC:
    def __init__(self,url,key):
        if not re.fullmatch(r'https://[a-z0-9]{20}\.supabase\.co',url):
            raise WorkerError('A hosted HTTPS Supabase project URL is required')
        try:
            payload=key.split('.')[1]
            role=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))['role']
        except (ValueError,IndexError,KeyError,TypeError):
            role=None
        if role!='service_role':raise WorkerError('A legacy service_role JWT is required in the trusted worker environment')
        self.url=url;self.key=key
    def __call__(self,name,**args):
        if name!='atlas_catalogue_job':raise WorkerError('Unexpected worker RPC')
        try:
            response=requests.post(self.url+'/rest/v1/rpc/'+name,headers={'apikey':self.key,'Authorization':'Bearer '+self.key},json=args,timeout=(5,30),allow_redirects=False)
            if not 200<=response.status_code<300:raise WorkerError('Worker database request failed; resume after checking configuration or lease ownership')
            value=response.json()
        except (requests.RequestException,ValueError):
            raise WorkerError('Worker database response unconfirmed; resume using the same version ID') from None
        if not isinstance(value,dict):raise WorkerError('Invalid worker database response')
        return value

class CatalogueWorker:
    def __init__(self,rpc,source=None,parsers=None):
        if source is None or parsers is None:
            from atlas_catalogue_source import CatalogueSource,parse_programme,parse_course
            source=source or CatalogueSource()
            parsers=parsers or {'programme':parse_programme,'course':parse_course}
        self.rpc=rpc;self.source=source;self.parsers=parsers;self.owner=str(uuid.uuid4())
    def call(self,action,data=None):
        return self.rpc('atlas_catalogue_job',p_action=action,p_version=self.version,p_owner=self.owner,p_year=self.year,p_data=data or {})
    def run(self,year,version,max_tasks=25,stop=lambda:False):
        self.year=str(year);self.version=str(uuid.UUID(str(version)))
        if not re.fullmatch(r'20[0-9]{2}',self.year) or type(max_tasks) is not int or not 1<=max_tasks<=1000:raise WorkerError('Invalid worker bounds')
        state=self.call('start')
        if state['status']=='published':return state
        if state['status']!='building':raise WorkerError('Version is closed; use a new version ID')
        previous_stop=self.source.stop
        last_beat=[float('-inf')]
        def heartbeat():
            if stop() or previous_stop():return True
            if time.monotonic()-last_beat[0]>=20:
                self.call('heartbeat');last_beat[0]=time.monotonic()
            return False
        self.source.stop=heartbeat
        claimed=False
        try:
            for _ in range(max_tasks):
                if stop():break
                task=self.call('claim')['task']
                claimed=True
                if task is None:return self.call('publish')
                last_beat[0]=float('-inf')
                lang=task['lang'];kind=task['kind'];path=task['path']
                if kind.startswith(('index','verify')):
                    rows,clusters=self.source.listing(lang,self.year,'Programme' if kind.endswith('Programme') else 'Course')
                    if kind.startswith('verify'):
                        digest=hashlib.md5('\n'.join(sorted(row['path'] for row in rows)).encode()).hexdigest()
                        self.call('verify',{'count':len(rows),'digest':digest})
                    else:
                        self.call('reset_index')
                        batch=[];size=0
                        for row in rows:
                            cost=len(json.dumps(row).encode())+2
                            if cost>20000:raise WorkerError('Catalogue index row too large')
                            if batch and (len(batch)==100 or size+cost>3000000):
                                self.call('enqueue',{'rows':batch});batch=[];size=0
                            batch.append(row);size+=cost
                        if batch:self.call('enqueue',{'rows':batch})
                        self.call('index_done',{'count':len(rows),'clusters':clusters})
                else:
                    from urllib.parse import urlsplit
                    if not re.fullmatch('/'+lang+'/'+('Programme' if kind=='programme' else 'course')+'/'+self.year+'/[A-Za-z0-9_-]+',path,re.I) or urlsplit(path).netloc:raise WorkerError('Invalid task path')
                    html=self.source.request('GET','https://catalogue.hanze.nl'+path)
                    document=self.parsers[kind](html,path,lang,self.year)
                    if kind=='programme':
                        for key in ('cluster','mode','level','language'):document[key]=task['summary'].get(key,'')
                    document['fetched']=datetime.datetime.now(datetime.timezone.utc).isoformat()
                    self.call('finish',{'document':document})
                self.source.pause(0.2)
            if claimed:self.call('release')
            return self.call('status')
        except Exception:
            try:
                if claimed:self.call('release',{'error':True})
            except Exception:pass
            raise
        finally:self.source.stop=previous_stop

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year',required=True)
    parser.add_argument('--version',default=None,help='Reuse this UUID to resume')
    parser.add_argument('--max-tasks',type=int,default=25)
    parser.add_argument('--once',action='store_true',help='Process one bounded slice, then release')
    args=parser.parse_args()
    stopped=[False]
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,lambda *_:stopped.__setitem__(0,True))
    try:
        rpc=WorkerRPC(os.environ.get('SUPABASE_URL','').strip().rstrip('/'),os.environ.get('SUPABASE_SERVICE_ROLE_KEY','').strip())
        version=str(uuid.UUID(args.version)) if args.version else str(uuid.uuid4())
        print(json.dumps({'version':version}),flush=True)
        runner=CatalogueWorker(rpc)
        while not stopped[0]:
            state=runner.run(args.year,version,args.max_tasks,lambda:stopped[0])
            print(json.dumps(state),flush=True)
            if state['status']=='published' or args.once:return 0
        return 130
    except Exception:
        print(json.dumps({'error':'Worker stopped; keep the printed version ID. Check worker credentials, lease or source availability before resuming.'}),flush=True)
        return 130 if stopped[0] else 1

if __name__=='__main__':raise SystemExit(main())
