from flask import Flask,request,jsonify,send_from_directory
from bs4 import BeautifulSoup
import requests,sqlite3,json,uuid,datetime,re,os
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DB=ROOT/'data'/'compass.sqlite3';DB.parent.mkdir(exist_ok=True)
CATALOGUE_DIR=ROOT/'data'/'catalogue-cache';CATALOGUE_DIR.mkdir(exist_ok=True)
app=Flask(__name__,static_folder=str(ROOT/'static'));app.config['MAX_CONTENT_LENGTH']=5000000

@app.after_request
def disable_gui_cache(response):
    if request.path == '/' or request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

BASE='https://catalogue.hanze.nl'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def db():
 c=sqlite3.connect(DB,timeout=15);c.row_factory=sqlite3.Row;return c
with db() as c:c.executescript('CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,state TEXT,revision INTEGER,updated TEXT); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,workspace TEXT,title TEXT,state TEXT,created TEXT);')
def text(x):return x.get_text(' ',strip=True) if x else ''
def cache_file(year,lang):return CATALOGUE_DIR/(f'{lang}-{year}.json')
def read_cache(year,lang):
 p=cache_file(year,lang)
 if not p.exists():return None
 try:
  d=json.loads(p.read_text(encoding='utf-8'))
  return d if isinstance(d,dict) and isinstance(d.get('results'),list) else None
 except Exception:return None
def write_cache(year,lang,d):
 d['saved']=now();tmp=cache_file(year,lang).with_suffix('.tmp');tmp.write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8');tmp.replace(cache_file(year,lang))
 meta={'saved':d['saved'],'complete':bool(d.get('complete')),'programmes':len([x for x in d.get('results',[]) if '/programme/' in x.get('path','').lower()]),'courses':len(d.get('courses',{})),'totalCourses':d.get('totalCourses',0)}
 cache_file(year,lang).with_suffix('.meta').write_text(json.dumps(meta),encoding='utf-8')
def compact_course(c):return {'metadata':c.get('metadata',{}),'outcomes':c.get('outcomes',''),'content':c.get('content',''),'source':c.get('source',''),'fetched':c.get('fetched','')}
def parse_course(path):
 s=get(path);meta={text(dt):text(dt.find_next_sibling('dd')) for dt in s.select('dt')};sections={}
 for h in s.select('h2'):
  label={'Leeruitkomsten':'Learning outcomes','Inhoud':'Content'}.get(text(h),text(h))
  if label not in ('Learning outcomes','Content'):continue
  col=h.find_parent(class_=re.compile('col-md-6'));rows=col.find_all('div',class_='row',recursive=False) if col else []
  sections[label]='\n'.join(row.get_text('\n',strip=True) for row in rows[1:])
 return {'metadata':meta,'outcomes':sections.get('Learning outcomes',''),'content':sections.get('Content',''),'source':BASE+path,'fetched':now()}
def norm(x):return re.sub(r'\s+',' ',str(x or '')).strip().lower()
def same_cluster(a,b):
 a=norm(a);b=norm(b);return bool(a and b and (a==b or a in b or b in a))
def offline_clusters(d):
 c=d.get('clusters') or []
 if c:return c
 return [{'id':n,'name':n} for n in sorted({r.get('cluster','') for r in d.get('results',[]) if r.get('cluster')})]
def latest_cache(lang):
 for f in sorted(CATALOGUE_DIR.glob(lang+'-*.json'),key=lambda f:f.stat().st_mtime,reverse=True):
  d=read_cache(f.stem.split('-',1)[1],lang)
  if d:return d
 return None
def derived_courses(d):
 out={}
 for r in d.get('results',[]):
  for m in (r.get('programme') or {}).get('modules',[]):
   for c in m.get('courses',[]):
    path=c.get('path')
    if not path:continue
    e=out.setdefault(path,{'name':(str(c.get('code',''))+' '+str(c.get('name',''))).strip(),'path':path,'cluster':r.get('cluster',''),'mode':'','level':'','language':'','clusters':set()})
    e['clusters'].add(r.get('cluster',''))
 return out
def cached_search(year,lang,kind,q,cluster):
 d=read_cache(year,lang)
 if not d:return None
 if kind=='Course':
  rows={r['path']:dict(r) for r in d.get('results',[]) if '/course/' in r.get('path','').lower()}
  for path,e in derived_courses(d).items():
   if path not in rows:rows[path]=e
  rows=list(rows.values())
 else:rows=[dict(r) for r in d.get('results',[]) if '/programme/' in r.get('path','').lower()]
 if cluster:
  want=next((c.get('name','') for c in offline_clusters(d) if str(c.get('id'))==cluster),cluster)
  rows=[r for r in rows if same_cluster(r.get('cluster'),want) or any(same_cluster(x,want) for x in r.get('clusters',[]))]
 q=str(q or '').lower().strip()
 if q:rows=[r for r in rows if q in ' '.join(str(r.get(k,'')) for k in ('name','path','cluster','mode','level','language')).lower()]
 rows=[{k:v for k,v in r.items() if k not in ('programme','clusters')} for r in rows]
 return {'results':rows,'count':str(len(rows)),'total':len(rows),'complete':bool(d.get('complete')),'warning':('Lokale cataloguskopie van ' if lang=='nl' else 'Local catalogue copy from ')+str(d.get('saved') or d.get('fetched') or '?'),'clusters':offline_clusters(d),'fetched':d.get('saved') or d.get('fetched') or '','truncated':not bool(d.get('complete')),'offline':True}
def get(path):
 if not re.fullmatch(r'/(?:en|nl)/(?:Programme|course)/20\d{2}/[A-Za-z0-9_-]+',path,re.I):raise ValueError('Invalid catalogue link')
 r=requests.get(BASE+path,timeout=(6,25),allow_redirects=False);r.raise_for_status();return BeautifulSoup(r.text,'html.parser')
def parse_programme(s,path):
 block=s.select_one('.programma')
 if not block:raise ValueError('Programme structure not recognised')
 modules=[]
 for comp in block.select('.component'):
  links=[a for a in comp.find_all('a',href=re.compile('/course/',re.I)) if a.find_parent(class_='component') is comp]
  if not links:continue
  h=comp.find('h3',recursive=False)
  if not h:continue
  cp=BeautifulSoup(str(h),'html.parser');ects=text(cp.select_one('.credits'))
  for x in cp.select('a,.credits'):x.decompose()
  name=text(cp) or 'Curriculum block';year=None
  for ancestor in [comp]+list(comp.parents):
   if 'component' not in getattr(ancestor,'attrs',{}).get('class',[]):continue
   match=re.search(r'(?:Year|Jaar)\s+(\d+)',text(ancestor.find('h3',recursive=False)),re.I)
   if match:year=int(match.group(1));break
  courses=[]
  for a in links:
   spans=a.find_all('span',recursive=False)
   courses.append({'code':text(spans[0]) if spans else a['href'].split('/')[-1],'name':text(spans[1]) if len(spans)>1 else text(a),'ects':text(a.select_one('.credits')),'path':a['href']})
  modules.append({'id':'m'+str(len(modules)+1),'name':name,'ects':ects,'year':year or 1,'yearInferred':year is None,'elective':'elective' in name.lower() or any(x.find_parent(class_='component') is comp for x in comp.select('.obligation')),'courses':courses})
 heading=block.find('h2');cp=BeautifulSoup(str(heading),'html.parser')
 for x in cp.select('.credits'):x.decompose()
 return {'programme':text(cp),'edition':path.split('/')[-2],'source':BASE+path,'fetched':now(),'modules':modules,'mappings':{},'targets':{},'notes':'','sessionTitle':'Curriculum review','cluster':'','mode':'','level':'','language':''}
@app.before_request
def origin_guard():
 if request.method=='POST' and request.headers.get('Origin') and request.headers['Origin']!=request.host_url.rstrip('/'):return jsonify(error='Cross-origin request refused'),403
@app.errorhandler(Exception)
def error(e):
 if isinstance(e,(ValueError,requests.RequestException)):msg=str(e)
 else:msg='Request failed; operation not confirmed. See server terminal.';app.logger.exception(e)
 return jsonify(error=msg),400
@app.get('/')
def home():return send_from_directory(ROOT/'static','index.html')
@app.get('/api/framework')
def framework():return jsonify(json.loads((ROOT/'framework.json').read_text(encoding='utf-8')))
def catalogue_clusters(soup):
 return [{'id': x.get('value',''), 'name': text(x.find_parent('label')) or text(soup.find('label', attrs={'for':x.get('id','')})) or x.get('value','')} for x in soup.select('input[name="SELECTED_SCHOOLS"]') if x.get('value')]

@app.get('/api/catalogue-clusters')
def catalogue_cluster_options():
 lang=request.args.get('lang','nl')
 if lang not in ('nl','en'):raise ValueError('Invalid catalogue language')
 try:
  r=requests.get(BASE+'/'+lang+'/Home/Search',timeout=20);r.raise_for_status()
  return jsonify(clusters=catalogue_clusters(BeautifulSoup(r.text,'html.parser')),offline=False)
 except requests.RequestException:
  d=read_cache('2026',lang) or latest_cache(lang)
  if d:return jsonify(clusters=offline_clusters(d),offline=True,fetched=d.get('saved') or d.get('fetched',''))
  raise

@app.post('/api/search')
def search():
 from urllib.parse import urljoin,urlparse
 d=request.json or {};year=str(d.get('year','2026'));kind=d.get('kind','Programme');cluster=str(d.get('cluster',''));lang=d.get('lang','nl');q=str(d.get('q',''))[:150]
 if lang not in ('nl','en') or not re.fullmatch(r'20\d{2}',year) or kind not in ('Programme','Course'):raise ValueError('Invalid search filters')
 source=d.get('source','online')
 if source=='local':
  local=cached_search(year,lang,kind,q,cluster)
  if local:return jsonify(local)
  raise ValueError('Geen lokale cataloguskopie voor deze editie en taal. Gebruik eerst Catalogus bijwerken.' if lang=='nl' else 'No local catalogue copy for this edition and language. Use Update catalogue first.')
 try:
  with requests.Session() as session:
   r=session.get(BASE+'/'+lang+'/Home/Search',timeout=20);r.raise_for_status();soup=BeautifulSoup(r.text,'html.parser');token=soup.select_one('input[name="__RequestVerificationToken"]');options=catalogue_clusters(soup)
   if cluster and cluster not in {x['id'] for x in options}:raise ValueError('Unknown catalogue cluster; reload the cluster list')
   fields={'Filters.SearchCriteria':q,'Filters.FilterByType':kind,'Filters.SelectedSchoolYear':year}
   if cluster:fields['SELECTED_SCHOOLS']=cluster
   if token:fields['__RequestVerificationToken']=token.get('value','')
   r=session.post(BASE+'/'+lang+'/Home/Search',data=fields,timeout=25);r.raise_for_status();seen=set();rows=[];expected=None;complete=False
   for step in range(100):
    soup=BeautifulSoup(r.text,'html.parser');area=soup.select_one('#search-results')
    if not area:raise ValueError('Catalogue search layout not recognised')
    count=text(area.select_one('.result-count'));number=re.search(r'([\d][\d,. ]*)',count);expected=int(re.sub(r'\D','',number.group(1))) if number else None;unique={}
    for row in area.select('.row'):
     link=row.find('a',href=re.compile('/(?:Programme|course)/',re.I))
     if not link:continue
     cells=[x for x in row.find_all('div',recursive=False) if 'd-lg-inline' in x.get('class',[])]
     unique[link['href']]={'name':text(link),'path':link['href'],'cluster':text(row.select_one('.school')),'mode':text(cells[0]).rstrip(' ,\u00a0') if kind=='Programme' and cells else '', 'level':text(cells[1]).rstrip(' ,\u00a0') if kind=='Programme' and len(cells)>1 else '', 'language':text(cells[-1]) if cells else ''}
    rows=list(unique.values());more=area.select_one('.more a[href]') or area.find('a',string=re.compile(r'^\s*(More|Meer)\s*$',re.I))
    if not more:complete=expected is not None and len(rows)==expected;break
    nexturl=urljoin(BASE,more['href']);parsed=urlparse(nexturl)
    if parsed.scheme!='https' or parsed.netloc!=urlparse(BASE).netloc or parsed.path!='/'+lang+'/Home/Search' or nexturl in seen:break
    seen.add(nexturl);r=session.get(nexturl,timeout=25);r.raise_for_status()
   result={'results':rows,'count':count,'total':expected,'complete':complete,'warning':'' if complete else ('Onvolledige catalogusresultaten: ' if lang=='nl' else 'Incomplete catalogue results: ')+str(len(rows))+(' van ' if lang=='nl' else ' of ')+str(expected if expected is not None else '?'),'clusters':options,'fetched':now(),'truncated':not complete,'offline':False}
   # Cache live search results as a supplement, without claiming a full copy.
   cached=read_cache(year,lang) or {'year':year,'lang':lang,'results':[],'courses':{},'clusters':options,'complete':False,'fetched':now()}
   known={x.get('path'):x for x in cached.get('results',[])}
   for x in rows:
    y=dict(x);old=known.get(x.get('path'),{})
    if old.get('programme'):y['programme']=old['programme']
    known[x.get('path')]=y
   cached['results']=list(known.values());cached['clusters']=options;cached['fetched']=now();write_cache(year,lang,cached)
   return jsonify(result)
 except requests.RequestException as e:
  raise ValueError('Online catalogus niet bereikbaar ('+e.__class__.__name__+'). Gebruik Zoek lokale catalogus.' if lang=='nl' else 'Online catalogue unreachable ('+e.__class__.__name__+'). Use Search local catalogue.')

import time,threading
JOB={};JOB_LOCK=threading.Lock();STOP=threading.Event()
def job_set(**k):
 with JOB_LOCK:JOB.update(k)
def with_retry(fn,*a):
 last=None
 for i in range(3):
  try:return fn(*a)
  except requests.RequestException as e:
   last=e
   if STOP.is_set():break
   time.sleep(2*(i+1))
 raise last
def list_programmes(year,lang):
 from urllib.parse import urljoin,urlparse
 with requests.Session() as session:
  r=session.get(BASE+'/'+lang+'/Home/Search',timeout=(6,25));r.raise_for_status();soup=BeautifulSoup(r.text,'html.parser');token=soup.select_one('input[name="__RequestVerificationToken"]');clusters=catalogue_clusters(soup)
  fields={'Filters.SearchCriteria':'','Filters.FilterByType':'Programme','Filters.SelectedSchoolYear':year}
  if token:fields['__RequestVerificationToken']=token.get('value','')
  r=session.post(BASE+'/'+lang+'/Home/Search',data=fields,timeout=(6,30));r.raise_for_status()
  rows=[];paths=set();seen=set();expected=None
  for step in range(100):
   soup=BeautifulSoup(r.text,'html.parser');area=soup.select_one('#search-results')
   if not area:raise ValueError('Catalogue search layout not recognised')
   ctext=text(area.select_one('.result-count'));m=re.search(r'([\d][\d,. ]*)',ctext);expected=int(re.sub(r'\D','',m.group(1))) if m else None
   for row in area.select('.row'):
    link=row.find('a',href=re.compile('/Programme/',re.I))
    if not link or link['href'] in paths:continue
    cells=[x for x in row.find_all('div',recursive=False) if 'd-lg-inline' in x.get('class',[])]
    paths.add(link['href']);rows.append({'name':text(link),'path':link['href'],'cluster':text(row.select_one('.school')),'mode':text(cells[0]).rstrip(' ,\u00a0') if cells else '','level':text(cells[1]).rstrip(' ,\u00a0') if len(cells)>1 else '','language':text(cells[-1]) if cells else ''})
   more=area.select_one('.more a[href]') or area.find('a',string=re.compile(r'^\s*(More|Meer)\s*$',re.I))
   if not more:break
   nxt=urljoin(BASE,more['href']);u=urlparse(nxt)
   if u.netloc!=urlparse(BASE).netloc or nxt in seen:break
   seen.add(nxt);r=session.get(nxt,timeout=(6,30));r.raise_for_status()
 return rows,clusters,expected
def crawl(year,lang,refresh):
 cache=None;state={'consec':0,'last':time.time()};failures=[]
 def save():
  cache['totalCourses']=len(cache['courses']);write_cache(year,lang,cache);state['last']=time.time()
 def fail(path,e):
  failures.append(path);state['consec']+=1;job_set(errors=len(failures),recent=(JOB.get('recent',[])+[path+': '+str(e)[:120]])[-5:])
 def check():
  if state['consec']>=10:raise RuntimeError('Gestopt na 10 mislukkingen achter elkaar. Laatste fout: '+((JOB.get('recent') or ['onbekend'])[-1])+'. Wat al is opgehaald blijft bewaard.')
  if time.time()-state['last']>30:save()
 try:
  job_set(phase='listing',done=0,total=0,eta=0,errors=0,recent=[],message='')
  prev=None if refresh else read_cache(year,lang)
  rows,clusters,expected=with_retry(list_programmes,year,lang)
  old={x.get('path'):x for x in (prev or {}).get('results',[])}
  for r in rows:
   o=old.get(r['path'])
   if o and o.get('programme'):r['programme']=o['programme']
  keep={r['path'] for r in rows}
  extras=[x for p,x in old.items() if p not in keep and '/programme/' not in p.lower()]
  cache={'year':year,'lang':lang,'results':rows+extras,'clusters':clusters,'courses':dict((prev or {}).get('courses',{})),'totalCourses':0,'complete':False,'fetched':now(),'expectedProgrammes':expected,'failed':[]}
  save()
  todo=[r for r in rows if not r.get('programme')];total=len(rows);done0=total-len(todo);job_set(phase='programmes',done=done0,total=total);t0=time.time();n=0
  for r in todo:
   if STOP.is_set():break
   try:
    r['programme']=with_retry(lambda path=r['path']:parse_programme(get(path),path));state['consec']=0
   except Exception as e:fail(r['path'],e)
   n+=1;job_set(done=done0+n,eta=int((len(todo)-n)*(time.time()-t0)/n));check();time.sleep(0.1)
  if not STOP.is_set():
   paths=list(dict.fromkeys(c.get('path','') for r in rows for m in (r.get('programme') or {}).get('modules',[]) for c in m.get('courses',[]) if c.get('path')))
   todo=[x for x in paths if x not in cache['courses']];total=len(paths);done0=total-len(todo);job_set(phase='courses',done=done0,total=total,eta=0);t0=time.time();n=0
   from concurrent.futures import ThreadPoolExecutor
   with ThreadPoolExecutor(max_workers=3) as ex:
    for i in range(0,len(todo),9):
     if STOP.is_set():break
     futs=[(x,ex.submit(with_retry,parse_course,x)) for x in todo[i:i+9]]
     for x,f in futs:
      try:cache['courses'][x]=compact_course(f.result());state['consec']=0
      except Exception as e:fail(x,e)
      n+=1
     job_set(done=done0+n,eta=int((len(todo)-n)*(time.time()-t0)/max(n,1)));check();time.sleep(0.2)
  stopped=STOP.is_set();cache['failed']=failures
  cache['complete']=(not stopped) and not failures and (expected is None or len(rows)==expected)
  save()
  job_set(state='stopped' if stopped else 'done',message='Gestopt; wat is opgehaald is bewaard.' if stopped else ('Klaar.' if not failures else 'Klaar, maar '+str(len(failures))+' items zijn mislukt; klik op Verder om ze opnieuw te proberen.'))
 except Exception as e:
  try:
   if cache is not None:save()
  except Exception:pass
  job_set(state='error',message=str(e) or e.__class__.__name__)

def crawl_all(year,refresh):
 msgs=[];states=[]
 try:
  for i,lang in enumerate(('nl','en')):
   if STOP.is_set():states.append('stopped');break
   job_set(lang=lang,step=i+1,steps=2);crawl(year,lang,refresh)
   with JOB_LOCK:st=JOB.get('state');m=JOB.get('message','')
   states.append(st);msgs.append(lang.upper()+': '+m)
  job_set(state='error' if 'error' in states else ('stopped' if 'stopped' in states else 'done'),message=' · '.join(msgs))
 finally:job_set(running=False)

@app.post('/api/catalogue-cache/start')
def catalogue_cache_start():
 d=request.json or {};year=str(d.get('year','2026'));lang=d.get('lang','nl')
 if lang not in ('nl','en') or not re.fullmatch(r'20\d{2}',year):raise ValueError('Invalid catalogue edition')
 with JOB_LOCK:
  if JOB.get('running'):return jsonify(job=dict(JOB))
  STOP.clear();JOB.clear();JOB.update(running=True,state='running',lang='nl',step=1,steps=2,year=year,phase='listing',done=0,total=0,eta=0,errors=0,recent=[],message='',started=now())
 threading.Thread(target=crawl_all,args=(year,bool(d.get('refresh'))),daemon=True).start()
 return jsonify(job=dict(JOB))

@app.post('/api/catalogue-cache/stop')
def catalogue_cache_stop():
 STOP.set();return jsonify(ok=True)

def cache_meta(year,lang):
 m=cache_file(year,lang).with_suffix('.meta')
 if m.exists():
  try:return json.loads(m.read_text(encoding='utf-8'))
  except Exception:return {}
 if cache_file(year,lang).exists():
  d=read_cache(year,lang)
  if d:return {'saved':d.get('saved',''),'complete':bool(d.get('complete')),'programmes':len([x for x in d.get('results',[]) if '/programme/' in x.get('path','').lower()]),'courses':len(d.get('courses',{})),'totalCourses':d.get('totalCourses',0)}
 return {}

@app.get('/api/catalogue-cache/status')
def catalogue_cache_status():
 lang=request.args.get('lang','nl');year=str(request.args.get('year','2026'));langs={l:cache_meta(year,l) for l in ('nl','en')};meta=langs.get(lang) or {}
 with JOB_LOCK:job=dict(JOB)
 return jsonify(available=bool(meta),year=year,lang=lang,saved=meta.get('saved',''),complete=bool(meta.get('complete')),programmes=meta.get('programmes',0),courses=meta.get('courses',0),totalCourses=meta.get('totalCourses',0),languages=langs,job=job)

@app.post('/api/programme')
def programme():
 path=request.json['path']
 try:return jsonify(parse_programme(get(path),path))
 except requests.RequestException:
  for p in CATALOGUE_DIR.glob('*.json'):
   d=read_cache(p.stem.split('-',1)[1],p.stem.split('-',1)[0])
   for r in (d or {}).get('results',[]):
    if r.get('path')==path and r.get('programme'):return jsonify(r['programme'])
  raise
@app.post('/api/course')
def course():
 path=request.json['path']
 try:return jsonify(parse_course(path))
 except requests.RequestException:
  for p in CATALOGUE_DIR.glob('*.json'):
   d=read_cache(p.stem.split('-',1)[1],p.stem.split('-',1)[0]);c=(d or {}).get('courses',{}).get(path)
   if c:return jsonify(c)
  raise
@app.post('/api/workspaces/export')
def export_workspaces():
 ids=request.json.get('ids',[])
 if not isinstance(ids,list) or not ids or len(ids)>1000 or any(not isinstance(x,str) for x in ids):raise ValueError('Select valid workspaces')
 with db() as c:
  items=[]
  for ident in dict.fromkeys(ids):
   w=c.execute('SELECT * FROM workspaces WHERE id=?',(ident,)).fetchone()
   if not w:return jsonify(error='Workspace no longer exists; reload the list'),409
   items.append({'id':ident,'revision':w['revision'],'updated':w['updated'],'state':json.loads(w['state']),'sessions':[dict(x) for x in c.execute('SELECT * FROM sessions WHERE workspace=?',(ident,)).fetchall()]})
 return jsonify(format='compass-workspace-backup-v1',exported=now(),workspaces=items)

@app.post('/api/workspaces/delete')
def delete_workspaces():
 d=request.json;selected=d.get('workspaces',[])
 if d.get('confirmed') is not True or not isinstance(selected,list) or not selected or len(selected)>1000:raise ValueError('Confirmed workspace selection required')
 if any(not isinstance(x,dict) or not isinstance(x.get('id'),str) or not isinstance(x.get('revision'),int) for x in selected):raise ValueError('Invalid selection')
 ids=[x['id'] for x in selected]
 if len(set(ids))!=len(ids):raise ValueError('Duplicate selection')
 with db() as c:
  c.execute('BEGIN IMMEDIATE');snapshots=[]
  for x in selected:
   w=c.execute('SELECT * FROM workspaces WHERE id=?',(x['id'],)).fetchone()
   if not w or w['revision']!=x['revision']:return jsonify(error='Workspace changed or disappeared; reload before deleting'),409
   snapshots.append({'workspace':dict(w),'sessions':[dict(v) for v in c.execute('SELECT * FROM sessions WHERE workspace=?',(x['id'],)).fetchall()]})
  recovery=ROOT/'data'/'deleted-workspaces';recovery.mkdir(exist_ok=True)
  backup=recovery/(str(uuid.uuid4())+'.json')
  backup.write_text(json.dumps({'deleted':now(),'items':snapshots},ensure_ascii=False,indent=2),encoding='utf-8')
  for ident in ids:
   c.execute('DELETE FROM sessions WHERE workspace=?',(ident,));c.execute('DELETE FROM workspaces WHERE id=?',(ident,))
 return jsonify(deleted=len(ids),recovery=backup.name)

@app.get('/api/workspaces')
def listing():
 show_all=request.args.get('all')=='1'
 with db() as c:rows=c.execute('SELECT id,state,revision,updated FROM workspaces ORDER BY updated DESC').fetchall()
 out=[]
 for r in rows:
  st=json.loads(r['state']);arch=bool(st.get('archived'))
  if arch and not show_all:continue
  out.append({'id':r['id'],'name':str(st.get('programme'))+((' ('+str(st.get('edition'))+')') if st.get('edition') else ''),'programme':st.get('programme'),'edition':st.get('edition'),'updated':r['updated'],'revision':r['revision'],'archived':arch})
 return jsonify(out)
@app.get('/api/workspaces/<ident>')
def load(ident):
 with db() as c:
  r=c.execute('SELECT * FROM workspaces WHERE id=?',(ident,)).fetchone();ss=c.execute('SELECT id,title,created FROM sessions WHERE workspace=? ORDER BY created DESC',(ident,)).fetchall()
 if not r:return jsonify(error='Workspace not found'),404
 return jsonify(id=ident,state=json.loads(r['state']),revision=r['revision'],sessions=[dict(x) for x in ss])
@app.post('/api/save')
def save():
 d=request.json;state=d['state']
 if not isinstance(state,dict) or not isinstance(state.get('modules'),list) or not state.get('programme'):raise ValueError('Invalid workspace')
 ident=d.get('id') or str(uuid.uuid4());snapshot=json.dumps(state,ensure_ascii=False);stamp=now()
 with db() as c:
  c.execute('BEGIN IMMEDIATE');old=c.execute('SELECT revision,state FROM workspaces WHERE id=?',(ident,)).fetchone()
  if d.get('id') and not old:return jsonify(error='Workspace was deleted; export your changes before creating a new workspace.'),409
  if old and old['revision']!=d.get('revision'):return jsonify(error='Another window changed this workspace. Export JSON, then reopen.'),409
  if old:
   prev=json.loads(old['state'])
   if prev.get('archived'):state['archived']=True;state['archivedAt']=prev.get('archivedAt','')
   else:state.pop('archived',None);state.pop('archivedAt',None)
   snapshot=json.dumps(state,ensure_ascii=False)
  revision=(old['revision'] if old else 0)+1
  c.execute('INSERT OR REPLACE INTO workspaces VALUES(?,?,?,?)',(ident,snapshot,revision,stamp))
  if d.get('finish'):c.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(str(uuid.uuid4()),ident,state.get('sessionTitle','Review'),snapshot,stamp))
 return jsonify(id=ident,revision=revision,updated=stamp)
@app.get('/api/sessions/<ident>')
def session(ident):
 with db() as c:r=c.execute('SELECT state FROM sessions WHERE id=?',(ident,)).fetchone()
 if not r:return jsonify(error='Session not found'),404
 return jsonify(state=json.loads(r['state']))

from urllib.parse import quote,unquote,urlparse
def ckey(code):return quote(str(code),safe="-_.!~*'()")
def ncode(x):return str(x or '').strip().upper()
def nname(x):return re.sub(r'\W+',' ',str(x or ''),flags=re.U).strip().lower()
def meaningful(a):return isinstance(a,dict) and a.get('status') not in (None,'','unreviewed')
def load_workspace_state(ident):
 with db() as c:r=c.execute('SELECT state FROM workspaces WHERE id=?',(ident,)).fetchone()
 if not r:raise ValueError('Workspace not found')
 return json.loads(r['state'])
def structure_for(path):
 try:return parse_programme(get(path),path),False
 except requests.RequestException:
  for f in CATALOGUE_DIR.glob('*.json'):
   lang_,year_=f.stem.split('-',1);d=read_cache(year_,lang_)
   for r in (d or {}).get('results',[]):
    if r.get('path')==path and r.get('programme'):return r['programme'],True
  raise
def build_plan(old,new,old_id='',lang='nl'):
 L=lambda nl,en:en if lang=='en' else nl
 oldm=old.get('modules',[]);newm=new.get('modules',[]);omap={m['id']:m for m in oldm};nmap={m['id']:m for m in newm};oldmaps=old.get('mappings',{}) or {}
 def codes(m):return {ncode(c.get('code')) for c in m.get('courses',[])}
 cand=[]
 for om in oldm:
  for nm in newm:
   sh=len(codes(om)&codes(nm));ne=nname(om['name'])==nname(nm['name']);ye=om.get('year')==nm.get('year');mn=min(len(codes(om)),len(codes(nm)))
   if (mn>0 and sh>=max(1,0.5*mn)) or (ne and ye):cand.append((-(sh*10+(5 if ne else 0)+(2 if ye else 0)),om['id'],nm['id']))
 cand.sort();mm={};usedm=set()
 for sc,o,n in cand:
  if o in mm or n in usedm:continue
  mm[o]=n;usedm.add(n)
 cm={};usedc=set()
 for o,n in mm.items():
  nc={ncode(c['code']):c for c in nmap[n].get('courses',[])}
  for c in omap[o].get('courses',[]):
   k=ncode(c['code'])
   if k in nc and (n,k) not in usedc:cm[(o,c['code'])]=(n,nc[k]['code'],False);usedc.add((n,k))
 lo=[(m,c) for m in oldm for c in m.get('courses',[]) if (m['id'],c['code']) not in cm];ln=[(m,c) for m in newm for c in m.get('courses',[]) if (m['id'],ncode(c['code'])) not in usedc]
 from collections import Counter
 co=Counter(ncode(c['code']) for m,c in lo);cn=Counter(ncode(c['code']) for m,c in ln);nidx={ncode(c['code']):(m,c) for m,c in ln}
 for m,c in lo:
  k=ncode(c['code'])
  if co[k]==1 and cn[k]==1 and k in nidx:
   nm_,nc_=nidx[k];cm[(m['id'],c['code'])]=(nm_['id'],nc_['code'],True);usedc.add((nm_['id'],k))
 def count_maps(prefix_ok):return sum(1 for k,a in oldmaps.items() if meaningful(a) and prefix_ok(k))
 items=[];modreasons={};coursereasons={};s=dict(modules_matched=len(mm),modules_new=0,modules_removed=0,courses_matched=len(cm),courses_unchanged=0,courses_changed=0,courses_new=0,courses_removed=0,mappings_transferred=0,mappings_flagged=0,mappings_dropped=0)
 def item(**k):
  base=dict(severity='info',type='',module_old='',module_new='',year_old='',year_new='',code_old='',code_new='',name_old='',name_new='',ects_old='',ects_new='',mappings=0,action='',detail='');base.update(k);items.append(base)
 rem_by_name={}
 for m,c in lo:
  if (m['id'],c['code']) not in cm:rem_by_name.setdefault(nname(c.get('name')),[]).append((m,c))
 new_unmatched=[(m,c) for m in newm for c in m.get('courses',[]) if (m['id'],ncode(c['code'])) not in usedc]
 new_by_name={}
 for m,c in new_unmatched:new_by_name.setdefault(nname(c.get('name')),[]).append((m,c))
 for om in oldm:
  mods_here=[c for c in om.get('courses',[])]
  if om['id'] in mm:
   nm=nmap[mm[om['id']]];rs=[]
   if str(om['name']).strip()!=str(nm['name']).strip():rs.append(L('naam: "'+str(om['name'])+'" \u2192 "'+str(nm['name'])+'"','name: "'+str(om['name'])+'" \u2192 "'+str(nm['name'])+'"'))
   if om.get('year')!=nm.get('year'):rs.append(L('studiejaar: '+str(om.get('year'))+' \u2192 '+str(nm.get('year')),'year: '+str(om.get('year'))+' \u2192 '+str(nm.get('year'))))
   if str(om.get('ects','')).strip()!=str(nm.get('ects','')).strip():rs.append('ECTS: '+str(om.get('ects',''))+' \u2192 '+str(nm.get('ects','')))
   if bool(om.get('elective'))!=bool(nm.get('elective')):rs.append(L('keuzeonderwijs gewijzigd','elective status changed'))
   removed=[c for c in mods_here if (om['id'],c['code']) not in cm or cm[(om['id'],c['code'])][0]!=nm['id']];added=[c for c in nm.get('courses',[]) if not any(v[0]==nm['id'] and ncode(v[1])==ncode(c['code']) for v in cm.values())]
   if removed or added:rs.append(L('deelvakken gewijzigd (+'+str(len(added))+' / \u2212'+str(len(removed))+')','courses changed (+'+str(len(added))+' / \u2212'+str(len(removed))+')'))
   modreasons[om['id']]=rs
   if rs:item(severity='check',type='module_changed',module_old=om['name'],module_new=nm['name'],year_old=om.get('year',''),year_new=nm.get('year',''),ects_old=om.get('ects',''),ects_new=nm.get('ects',''),mappings=count_maps(lambda k,i=om['id']:k.partition('|')[2]==i),action=L('modulebrede mappings overgenomen, maar teruggezet op "niet beoordeeld"','module-wide mappings carried over but reset to "unreviewed"'),detail='; '.join(rs))
   else:s['courses_unchanged']+=0
  else:
   s['modules_removed']+=1
   n=count_maps(lambda k,i=om['id']:k.partition('|')[2].partition('::')[0]==i)
   item(severity='warning' if n else 'info',type='module_removed',module_old=om['name'],year_old=om.get('year',''),ects_old=om.get('ects',''),mappings=n,action=L('niet overgezet','not carried over'),detail=L('Deze module komt niet meer voor in de nieuwe editie.','This module no longer exists in the new edition.'))
 for nm in newm:
  if nm['id'] not in usedm:
   s['modules_new']+=1;item(type='module_new',module_new=nm['name'],year_new=nm.get('year',''),ects_new=nm.get('ects',''),action=L('nieuw, nog niet gemapt','new, not mapped yet'),detail=L('Nieuwe module in de nieuwe editie.','New module in the new edition.'))
 for om in oldm:
  for c in om.get('courses',[]):
   k=(om['id'],c['code']);nm_name=''
   mcount=count_maps(lambda key,i=om['id'],cc=c['code']:key.partition('|')[2]==i+'::'+ckey(cc))
   if k in cm:
    nmid,ncd,cross=cm[k];nm=nmap[nmid];nc=next(x for x in nm.get('courses',[]) if ncode(x['code'])==ncode(ncd));rs=[]
    if str(c.get('name','')).strip()!=str(nc.get('name','')).strip():rs.append(L('naam: "'+str(c.get('name',''))+'" \u2192 "'+str(nc.get('name',''))+'"','name: "'+str(c.get('name',''))+'" \u2192 "'+str(nc.get('name',''))+'"'))
    if str(c.get('ects','')).strip()!=str(nc.get('ects','')).strip():rs.append('ECTS: '+str(c.get('ects',''))+' \u2192 '+str(nc.get('ects','')))
    if cross or mm.get(om['id'])!=nmid:rs.append(L('verplaatst van module "'+str(om['name'])+'" naar "'+str(nm['name'])+'"','moved from module "'+str(om['name'])+'" to "'+str(nm['name'])+'"'))
    if om.get('year')!=nm.get('year'):rs.append(L('studiejaar: '+str(om.get('year'))+' \u2192 '+str(nm.get('year')),'year: '+str(om.get('year'))+' \u2192 '+str(nm.get('year'))))
    coursereasons[k]=rs
    if rs:
     s['courses_changed']+=1;item(severity='check',type='course_changed',module_old=om['name'],module_new=nm['name'],year_old=om.get('year',''),year_new=nm.get('year',''),code_old=c['code'],code_new=nc['code'],name_old=c.get('name',''),name_new=nc.get('name',''),ects_old=c.get('ects',''),ects_new=nc.get('ects',''),mappings=mcount,action=L('mapping overgenomen, teruggezet op "niet beoordeeld"','mapping carried over, reset to "unreviewed"'),detail='; '.join(rs))
    else:s['courses_unchanged']+=1
   else:
    s['courses_removed']+=1;sug=[x for x in new_by_name.get(nname(c.get('name')),[]) if ncode(x[1]['code'])!=ncode(c['code'])]
    d=L('Vakcode komt niet meer voor in de nieuwe editie.','Course code no longer exists in the new edition.')
    if sug:d+=' '+L('Mogelijk herzien: nieuwe code '+', '.join(str(x[1]['code']) for x in sug)+' heeft dezelfde naam. Niet automatisch gekoppeld.','Possibly revised: new code '+', '.join(str(x[1]['code']) for x in sug)+' has the same name. Not linked automatically.')
    item(severity='warning' if (mcount or sug) else 'info',type='course_removed',module_old=om['name'],year_old=om.get('year',''),code_old=c['code'],name_old=c.get('name',''),ects_old=c.get('ects',''),mappings=mcount,action=L('niet overgezet','not carried over'),detail=d,code_new=', '.join(str(x[1]['code']) for x in sug))
 for m,c in new_unmatched:
  s['courses_new']+=1;sug=[x for x in rem_by_name.get(nname(c.get('name')),[]) if ncode(x[1]['code'])!=ncode(c['code'])]
  d=L('Nieuw vak in de nieuwe editie.','New course in the new edition.')
  if sug:d+=' '+L('Mogelijk herzien: oude code '+', '.join(str(x[1]['code']) for x in sug)+' had dezelfde naam. Niet automatisch gekoppeld.','Possibly revised: old code '+', '.join(str(x[1]['code']) for x in sug)+' had the same name. Not linked automatically.')
  item(severity='warning' if sug else 'info',type='course_new',module_new=m['name'],year_new=m.get('year',''),code_new=c['code'],name_new=c.get('name',''),ects_new=c.get('ects',''),action=L('nieuw, nog niet gemapt','new, not mapped yet'),detail=d,code_old=', '.join(str(x[1]['code']) for x in sug))
 newmaps={};dropped=[];oe=str(old.get('edition',''))
 for k,a in oldmaps.items():
  if not isinstance(a,dict):continue
  oid,_,ent=k.partition('|');mid,_,code=ent.partition('::')
  if code:
   code=unquote(code);t=cm.get((mid,code))
   if not t:
    if meaningful(a):s['mappings_dropped']+=1
    dropped.append({'key':k,'outcome':oid,'module':(omap.get(mid) or {}).get('name',''),'code':code,'mapping':a});continue
   nk=oid+'|'+t[0]+'::'+ckey(t[1]);rs=coursereasons.get((mid,code),[])
  else:
   if mid not in mm:
    if meaningful(a):s['mappings_dropped']+=1
    dropped.append({'key':k,'outcome':oid,'module':(omap.get(mid) or {}).get('name',''),'code':'','mapping':a});continue
   nk=oid+'|'+mm[mid];rs=modreasons.get(mid,[])
  v=dict(a)
  if rs and meaningful(a):
   v['previous']={'status':a.get('status'),'evidence':a.get('evidence',''),'edition':oe,'reasons':rs};v['status']='unreviewed';v['evidence']='['+L('Controleren na kopi\u00ebren van ','Check after copying from ')+oe+': '+'; '.join(rs)+'; '+L('eerdere status','previous status')+': '+str(a.get('status'))+'] '+str(a.get('evidence','') or '');s['mappings_flagged']+=1
  elif meaningful(a):s['mappings_transferred']+=1
  newmaps[nk]=v
 ns=json.loads(json.dumps(new));ns['mappings']=newmaps;ns['targets']=json.loads(json.dumps(old.get('targets',{})));[ns.__setitem__(k,json.loads(json.dumps(old[k]))) for k in ('custom','framework') if old.get(k)];ns['notes']=old.get('notes','');ns['sessionTitle']=old.get('sessionTitle','Review')
 for k in ('cluster','mode','level','language'):ns[k]=old.get(k) or new.get(k,'')
 ns['migration']={'from':{'id':old_id,'edition':oe,'programme':old.get('programme'),'source':old.get('source')},'date':now(),'summary':s,'dropped':dropped,'items':items}
 report={'from':{'programme':old.get('programme'),'edition':oe},'to':{'programme':new.get('programme'),'edition':new.get('edition'),'source':new.get('source')},'summary':s,'items':items}
 return ns,report
@app.post('/api/year-copy/candidates')
def yc_candidates():
 d=request.json or {};old=load_workspace_state(d.get('workspace',''));year=str(d.get('year',''))
 if not re.fullmatch(r'20\d{2}',year):raise ValueError('Invalid edition')
 m=re.fullmatch(r'/(nl|en)/Programme/(20\d{2})/([A-Za-z0-9_-]+)',urlparse(old.get('source','')).path,re.I)
 if not m:return jsonify(candidates=[],reason='unknown-source')
 lang,oy,code=m.group(1).lower(),m.group(2),m.group(3);preds=[]
 if code.endswith(oy[-2:]):preds.append(code[:-2]+year[-2:])
 preds.append(code);found=[];seen=set();local=read_cache(year,lang);known={r['path'].lower():r for r in (local or {}).get('results',[])}
 for p in dict.fromkeys('/'+lang+'/Programme/'+year+'/'+x for x in preds):
  r=known.get(p.lower())
  if r:found.append({'name':r.get('name',''),'path':r['path'],'reason':'voorspeld, lokale catalogus / predicted, local catalogue'});seen.add(r['path'].lower());continue
  try:
   get(p);found.append({'name':'','path':p,'reason':'voorspeld, online gevonden / predicted, found online'});seen.add(p.lower())
  except Exception:pass
 alt=cached_search(year,lang,'Programme',old.get('programme',''),'')
 for r in (alt or {}).get('results',[])[:8]:
  if r['path'].lower() not in seen:found.append({'name':r.get('name',''),'path':r['path'],'reason':'zelfde naam, lokale catalogus / same name, local catalogue'});seen.add(r['path'].lower())
 return jsonify(candidates=found,hasLocal=bool(local))
@app.post('/api/year-copy/plan')
def yc_plan():
 d=request.json or {};old=load_workspace_state(d.get('workspace',''));new,offline=structure_for(d.get('path',''))
 ns,report=build_plan(old,new,d.get('workspace',''),d.get('lang','nl'));report['offline']=offline
 return jsonify(report)
@app.post('/api/year-copy/commit')
def yc_commit():
 d=request.json or {};ident=d.get('workspace','');old=load_workspace_state(ident);new,offline=structure_for(d.get('path',''))
 ns,report=build_plan(old,new,ident,d.get('lang','nl'));ns.pop('archived',None);ns.pop('archivedAt',None);nid=str(uuid.uuid4());stamp=now()
 with db() as c:
  c.execute('BEGIN IMMEDIATE');c.execute('INSERT INTO workspaces VALUES(?,?,?,?)',(nid,json.dumps(ns,ensure_ascii=False),1,stamp))
  if d.get('archive',True):
   r=c.execute('SELECT state FROM workspaces WHERE id=?',(ident,)).fetchone()
   if r:
    st=json.loads(r['state']);st['archived']=True;st['archivedAt']=stamp;c.execute('UPDATE workspaces SET state=? WHERE id=?',(json.dumps(st,ensure_ascii=False),ident))
 return jsonify(id=nid,name=str(ns.get('programme'))+' ('+str(ns.get('edition'))+')',summary=report['summary'],archived=bool(d.get('archive',True)))
@app.post('/api/workspaces/archive')
def archive_workspaces():
 d=request.json or {};ids=d.get('ids',[]);flag=bool(d.get('archived',True))
 if not isinstance(ids,list) or not ids or len(ids)>1000 or any(not isinstance(x,str) for x in ids):raise ValueError('Select valid workspaces')
 with db() as c:
  c.execute('BEGIN IMMEDIATE')
  for ident in dict.fromkeys(ids):
   r=c.execute('SELECT state FROM workspaces WHERE id=?',(ident,)).fetchone()
   if not r:return jsonify(error='Workspace no longer exists; reload the list'),409
   st=json.loads(r['state'])
   if flag:st['archived']=True;st['archivedAt']=now()
   else:st.pop('archived',None);st.pop('archivedAt',None)
   c.execute('UPDATE workspaces SET state=? WHERE id=?',(json.dumps(st,ensure_ascii=False),ident))
 return jsonify(count=len(ids),archived=flag)

LIB_DOMAINS=['Informatie & data geletterdheid','Communicatie & samenwerking','Digitale content creatie','Digitale veiligheid','Probleemoplossend vermogen']
LIB_LEVELS=['I. Starten','II. Toepassen','III. Verdiepen','IV. Richting geven']
LIB_STATUS=['Concept','Beproefd','Gevalideerd']
LIB_VERSION='3'
def lib_file(n):
 import os
 return os.path.join(os.path.dirname(os.path.abspath(__file__)),n)
def lib_seeds():
 with open(lib_file('library_seed.json'),encoding='utf-8') as f:return json.load(f)
def lib_ensure(c):
 c.execute('CREATE TABLE IF NOT EXISTS library(id TEXT PRIMARY KEY,item TEXT NOT NULL,source TEXT,created TEXT,updated TEXT)')
 c.execute('CREATE TABLE IF NOT EXISTS library_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
 r=c.execute("SELECT value FROM library_meta WHERE key='version'").fetchone()
 if r and r['value']==LIB_VERSION:return
 c.execute("DELETE FROM library WHERE source IN ('web','curated')")
 for x in lib_seeds():
  item={k:v for k,v in x.items() if k!='id'}
  c.execute('INSERT OR REPLACE INTO library VALUES(?,?,?,?,?)',(x['id'],json.dumps(item,ensure_ascii=False),'curated',now(),now()))
 c.execute("INSERT OR REPLACE INTO library_meta(key,value) VALUES('version',?)",(LIB_VERSION,))
def lib_clean(d):
 if not isinstance(d,dict):raise ValueError('Invalid example')
 s=lambda k,n:str(d.get(k,'') or '').strip()[:n]
 item={'title':s('title',200),'domain':s('domain',100),'level':s('level',40),'institution':s('institution',200),'summary':s('summary',1500),'activity':s('activity',2000),'ai_role':s('ai_role',700),'output':s('output',700),'assessment':s('assessment',700),'duration':s('duration',80),'url':s('url',500),'status':s('status',30)}
 if not item['title']:raise ValueError('Titel is verplicht.')
 if item['domain'] not in LIB_DOMAINS:raise ValueError('Kies een DigComp-domein.')
 if item['level'] not in LIB_LEVELS:raise ValueError('Kies een niveau van de leeruitkomst.')
 item['outcome']='o%d'%(LIB_DOMAINS.index(item['domain'])*4+LIB_LEVELS.index(item['level'])+1)
 if item['url'] and not re.fullmatch(r'https?://[^ <>"]+',item['url'],re.I):raise ValueError('De link moet beginnen met http:// of https:// en mag geen spaties bevatten.')
 if item['status'] not in LIB_STATUS:item['status']='Concept'
 tags=d.get('tags',[]);tags=tags.split(',') if isinstance(tags,str) else tags
 item['tags']=[str(t).strip()[:40] for t in (tags if isinstance(tags,list) else []) if str(t).strip()][:12]
 return item
def lib_row(r):
 x=json.loads(r['item']);x.update(id=r['id'],source=r['source'],created=r['created'],updated=r['updated']);return x
@app.get('/api/library')
def library_list():
 with db() as c:
  lib_ensure(c);rows=c.execute('SELECT * FROM library ORDER BY id ASC').fetchall()
 return jsonify([lib_row(r) for r in rows])
@app.get('/api/library/outcomes')
def library_outcomes():
 with open(lib_file('framework.json'),encoding='utf-8') as f:fw=json.load(f)
 d={}
 try:
  with open(lib_file('static/translations.en.json'),encoding='utf-8') as f:t=json.load(f)
  if isinstance(t,dict) and isinstance(t.get('translations'),dict):t=t['translations']
  if isinstance(t,dict):d={k:v for k,v in t.items() if isinstance(k,str) and isinstance(v,str)}
 except Exception:d={}
 return jsonify(outcomes=fw,dict=d)
@app.get('/api/library/translations')
def library_translations():
 try:
  with open(lib_file('library_seed.en.json'),encoding='utf-8') as f:return jsonify(json.load(f))
 except FileNotFoundError:return jsonify({})
@app.post('/api/library')
def library_add():
 item=lib_clean((request.json or {}).get('item'));ident=str(uuid.uuid4());stamp=now()
 with db() as c:
  lib_ensure(c);c.execute('INSERT INTO library VALUES(?,?,?,?,?)',(ident,json.dumps(item,ensure_ascii=False),'handmatig',stamp,stamp))
 return jsonify(id=ident)
@app.post('/api/library/update')
def library_update():
 d=request.json or {};item=lib_clean(d.get('item'))
 with db() as c:
  lib_ensure(c)
  if not c.execute('SELECT 1 FROM library WHERE id=?',(d.get('id',''),)).fetchone():return jsonify(error='Voorbeeld bestaat niet meer; ververs de bibliotheek.'),409
  c.execute('UPDATE library SET item=?,updated=? WHERE id=?',(json.dumps(item,ensure_ascii=False),now(),d['id']))
 return jsonify(ok=True)
@app.post('/api/library/delete')
def library_delete():
 d=request.json or {}
 with db() as c:
  lib_ensure(c);n=c.execute('DELETE FROM library WHERE id=?',(d.get('id',''),)).rowcount
 if not n:return jsonify(error='Voorbeeld bestaat niet meer; ververs de bibliotheek.'),409
 return jsonify(deleted=n)
LVS={'I. Starten','II. Toepassen','III. Verdiepen','IV. Richting geven'}
with db() as c:c.execute('CREATE TABLE IF NOT EXISTS competence_sets(id TEXT PRIMARY KEY,name TEXT NOT NULL,data TEXT NOT NULL,updated TEXT)')
def cs_clean(d):
 name=str(d.get('name') or '').strip()[:120]
 if not name:raise ValueError('Geef de set een naam.')
 out=[];seen=set()
 for o in (d.get('outcomes') or [])[:200]:
  oid=str(o.get('id') or '')[:80];dom=str(o.get('domain') or '').strip()[:120];txt=str(o.get('text') or '').strip()[:4000];lv=str(o.get('level') or '');col=str(o.get('color') or '')
  if not oid or not dom or not txt or lv not in LVS or (dom.lower(),lv) in seen:raise ValueError('Ongeldige of dubbele leeruitkomst in de set.')
  seen.add((dom.lower(),lv));out.append(dict(id=oid,domain=dom,level=lv,text=txt,color=col if re.fullmatch(r'#[0-9A-Fa-f]{6}',col) else '#8E6BBF'))
 if not out:raise ValueError('Een set heeft minstens een leeruitkomst.')
 return name,out
@app.get('/api/competence-sets')
def cs_list():
 with db() as c:rows=c.execute('SELECT id,name,data,updated FROM competence_sets ORDER BY lower(name)').fetchall()
 return jsonify([dict(id=r['id'],name=r['name'],updated=r['updated'],outcomes=json.loads(r['data'])) for r in rows])
@app.post('/api/competence-sets')
def cs_save():
 d=request.json or {}
 try:name,out=cs_clean(d)
 except ValueError as e:return jsonify(error=str(e)),400
 ident=str(d.get('id') or '')[:80] or str(uuid.uuid4())
 with db() as c:
  c.execute('BEGIN IMMEDIATE')
  if c.execute('SELECT 1 FROM competence_sets WHERE lower(name)=lower(?) AND id!=?',(name,ident)).fetchone():return jsonify(error='Er bestaat al een set met deze naam.'),409
  c.execute('INSERT OR REPLACE INTO competence_sets VALUES(?,?,?,?)',(ident,name,json.dumps(out,ensure_ascii=False),now()))
 return jsonify(id=ident,name=name)
@app.post('/api/competence-sets/delete')
def cs_delete():
 d=request.json or {}
 with db() as c:n=c.execute('DELETE FROM competence_sets WHERE id=?',(str(d.get('id','')),)).rowcount
 if not n:return jsonify(error='Set bestaat niet meer.'),409
 return jsonify(deleted=n)
if __name__=='__main__':app.run(host='127.0.0.1',port=int(os.environ.get('PORT','8022')),debug=False)
