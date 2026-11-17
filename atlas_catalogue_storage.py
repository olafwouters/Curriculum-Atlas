"""Catalogue storage RPC client. Inject a user or trusted-worker transport; no credentials here."""
import json
import re
import uuid

class CatalogueStorage:
    def __init__(self,rpc):
        self.rpc=rpc
    @staticmethod
    def edition(value):
        value=str(value)
        if not re.fullmatch(r'20[0-9]{2}',value):raise ValueError('Invalid catalogue edition')
        return value
    def write(self,action,version,data=None,year=None):
        return self.rpc('atlas_catalogue_write',p_action=action,p_version=str(uuid.UUID(str(version))),p_edition=self.edition(year) if year is not None else None,p_data={} if data is None else data)
    def begin(self,year,version=None):
        return self.write('begin',version or uuid.uuid4(),year=year)
    def checkpoint(self,version,state):
        if not isinstance(state,dict):raise ValueError('Checkpoint must be an object')
        return self.write('checkpoint',version,state)
    def state(self,version):return self.write('state',version)
    def fail(self,version):return self.write('fail',version)
    def put(self,version,entries):
        batch=[]
        size=0
        for entry in entries:
            cost=len(json.dumps(entry).encode('utf-8'))+2
            if cost>3500000:raise ValueError('Catalogue entry exceeds transport batch limit')
            if batch and (len(batch)==100 or size+cost>3500000):
                self.write('put',version,{'entries':batch});batch=[];size=0
            batch.append(entry);size+=cost
        if batch:self.write('put',version,{'entries':batch})
    def publish(self,version,manifest):
        if set(manifest)!={'nl','en'}:raise ValueError('Both catalogue languages required')
        return self.write('publish',version,{'manifest':manifest})
    def upload_bundle(self,bundle,version=None):
        if set(bundle)!={'nl','en'}:raise ValueError('Both catalogue languages required')
        year=self.edition(bundle['nl'].get('year'))
        manifest={};entries=[]
        for lang in ('nl','en'):
            data=bundle[lang]
            if data.get('lang')!=lang or str(data.get('year'))!=year or data.get('complete') is not True or data.get('failed'):
                raise ValueError('Only complete matching catalogue bundles can be published')
            programmes=[row for row in data['results'] if '/programme/' in row['path'].lower()]
            summaries={row['path']:row for row in data['results'] if '/course/' in row['path'].lower()}
            courses=data['courses']
            if len(programmes)!=data['expectedProgrammes'] or len(courses)!=data['totalCourses']:
                raise ValueError('Catalogue count mismatch')
            manifest[lang]={'programmes':len(programmes),'courses':len(courses),'listed_courses':data['expectedListedCourses'],'clusters':data['clusters']}
            for row in programmes:
                entries.append({'lang':lang,'path':row['path'],'kind':'programme','summary':{k:v for k,v in row.items() if k!='programme'},'document':row['programme']})
            for path,document in courses.items():
                entries.append({'lang':lang,'path':path,'kind':'course','summary':summaries.get(path,{'path':path,'name':path.split('/')[-1]}),'document':document})
        started=self.begin(year,version)
        version=started['version']
        if started['status']=='published':return started
        if started['status']!='building':raise ValueError('Catalogue version is closed')
        self.put(version,entries)
        return self.publish(version,manifest)
    def read(self,year,lang,path=None,kind='programme',offset=0,limit=100,query='',cluster='',version=None):
        if lang not in ('nl','en'):raise ValueError('Invalid catalogue language')
        return self.rpc('atlas_catalogue_read',p_edition=self.edition(year),p_lang=lang,p_path=path,p_kind=kind,p_offset=offset,p_limit=limit,p_query=query,p_cluster=cluster,p_version=version)
