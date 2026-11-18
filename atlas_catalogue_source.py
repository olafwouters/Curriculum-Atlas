"""Bounded, bilingual Hanze catalogue downloader; no database writes or Flask imports."""
import datetime
import re
import time
from urllib.parse import urljoin,urlsplit
import requests
from bs4 import BeautifulSoup

BASE='https://catalogue.hanze.nl'
PATH=re.compile(r'/(nl|en)/(Programme|course)/(20\d{2})/([A-Za-z0-9_-]+)',re.I)

class CatalogueError(Exception):
    pass

def text(node):
    return node.get_text(' ',strip=True) if node else ''

def edition(value):
    value=str(value)
    if not re.fullmatch(r'20\d{2}',value):
        raise CatalogueError('Invalid catalogue edition')
    return value

def detail_path(value,lang,year,kind=None):
    url=urlsplit(urljoin(BASE,value))
    match=PATH.fullmatch(url.path)
    if url.scheme!='https' or url.netloc!='catalogue.hanze.nl' or url.query or url.fragment or not match:
        raise CatalogueError('Unsafe or unexpected catalogue detail link')
    if match[1].lower()!=lang or match[3]!=year or (kind and match[2].lower()!=kind.lower()):
        raise CatalogueError('Catalogue link does not match language, edition or kind')
    return url.path

def search_url(value,lang):
    url=urlsplit(urljoin(BASE,value))
    if url.scheme!='https' or url.netloc!='catalogue.hanze.nl' or url.path!='/'+lang+'/Home/Search' or url.fragment:
        raise CatalogueError('Unsafe catalogue pagination link')
    return url.geturl()

def parse_listing(html,lang,year,kind):
    soup=BeautifulSoup(html,'html.parser')
    area=soup.select_one('#search-results')
    if area is None:
        raise CatalogueError('Catalogue search layout not recognised')
    counter=area.select_one('.result-count') or soup.select_one('.result-count')
    count=re.search(r'(\d[\d\s,.\xa0]*)',text(counter))
    if not count:
        raise CatalogueError('Catalogue result count unavailable; completeness cannot be verified')
    expected=int(re.sub(r'\D','',count[1]))
    found={}
    for link in area.find_all('a',href=True):
        if not PATH.fullmatch(urlsplit(urljoin(BASE,link['href'])).path):
            continue
        path=detail_path(link['href'],lang,year,kind)
        row=link.find_parent(class_='row') or link.parent
        cells=[cell for cell in row.find_all('div',recursive=False) if 'd-lg-inline' in cell.get('class',[])]
        found[path]={'name':text(link),'path':path,'cluster':text(row.select_one('.school')),
                     'mode':text(cells[0]).rstrip(' ,\u00a0') if kind=='Programme' and cells else '',
                     'level':text(cells[1]).rstrip(' ,\u00a0') if kind=='Programme' and len(cells)>1 else '',
                     'language':text(cells[-1]) if cells else ''}
    more=area.select_one('.more a[href]') or area.find('a',string=re.compile(r'^\s*(More|Meer)\s*$',re.I))
    next_url=search_url(more['href'],lang) if more and more.get('href') else None
    clusters=[{'id':node['value'],'name':text(node.find_parent('label')) or text(soup.find('label',attrs={'for':node.get('id','')})) or node['value']}
              for node in soup.select('input[name="SELECTED_SCHOOLS"][value]') if node['value']]
    return found,expected,next_url,clusters

def parse_programme(html,path,lang,year):
    detail_path(path,lang,year,'Programme')
    soup=BeautifulSoup(html,'html.parser')
    block=soup.select_one('.programma')
    if block is None:
        raise CatalogueError('Programme structure not recognised')
    modules=[]
    for component in block.select('.component'):
        links=[a for a in component.find_all('a',href=True) if '/course/' in a['href'].lower() and a.find_parent(class_='component') is component]
        if not links:
            continue
        heading=component.find('h3',recursive=False)
        if heading is None:
            raise CatalogueError('Programme module heading missing')
        clean=BeautifulSoup(str(heading),'html.parser')
        ects=text(clean.select_one('.credits'))
        for node in clean.select('a,.credits'):
            node.decompose()
        study_year=None
        for ancestor in [component]+list(component.parents):
            if 'component' not in getattr(ancestor,'attrs',{}).get('class',[]):
                continue
            match=re.search(r'(?:Year|Jaar)\s+(\d+)',text(ancestor.find('h3',recursive=False)),re.I)
            if match:
                study_year=int(match[1])
                break
        courses=[]
        for link in links:
            course_path=detail_path(link['href'],lang,year,'Course')
            spans=link.find_all('span',recursive=False)
            courses.append({'code':text(spans[0]) if spans else course_path.split('/')[-1],
                            'name':text(spans[1]) if len(spans)>1 else text(link),
                            'ects':text(link.select_one('.credits')),'path':course_path})
        name=text(clean) or 'Curriculum block'
        modules.append({'id':'m'+str(len(modules)+1),'name':name,'ects':ects,'year':study_year or 1,
                        'yearInferred':study_year is None,'elective':'elective' in name.lower() or bool(component.select('.obligation')),'courses':courses})
    if not modules:
        raise CatalogueError('Programme has no recognised curriculum modules; not publishing an empty curriculum')
    heading=BeautifulSoup(str(block.find('h2')),'html.parser')
    for node in heading.select('.credits'):
        node.decompose()
    return {'programme':text(heading),'edition':year,'source':BASE+path,'modules':modules,'mappings':{},'targets':{},
            'notes':'','sessionTitle':'Curriculum review','cluster':'','mode':'','level':'','language':''}

def parse_course(html,path,lang,year):
    detail_path(path,lang,year,'Course')
    soup=BeautifulSoup(html,'html.parser')
    metadata={text(node):text(node.find_next_sibling('dd')) for node in soup.select('dt')}
    sections={}
    for heading in soup.select('h2'):
        label={'Leeruitkomsten':'Learning outcomes','Inhoud':'Content'}.get(text(heading),text(heading))
        if label not in ('Learning outcomes','Content'):
            continue
        column=heading.find_parent(class_=re.compile('col-md-6'))
        rows=column.find_all('div',class_='row',recursive=False) if column else []
        sections[label]='\n'.join(row.get_text('\n',strip=True) for row in rows[1:])
    if not metadata and not sections:
        raise CatalogueError('Course layout not recognised')
    return {'metadata':metadata,'outcomes':sections.get('Learning outcomes',''),'content':sections.get('Content',''),'source':BASE+path}

class CatalogueSource:
    def __init__(self,session=None,pause=time.sleep,stop=None,max_pages=500):
        self.session=session or requests.Session()
        self.pause=pause
        self.stop=stop or (lambda:False)
        self.max_pages=max_pages

    def check_stop(self):
        if self.stop():
            raise CatalogueError('Catalogue update cancelled; last published catalogue remains unchanged')

    def request(self,method,url,**kwargs):
        for attempt in range(3):
            self.check_stop()
            try:
                response=self.session.request(method,url,timeout=(6,25),allow_redirects=False,**kwargs)
                if 300<=response.status_code<400:
                    raise CatalogueError('Catalogue redirected unexpectedly; update stopped')
                response.raise_for_status()
                return response.text
            except requests.RequestException:
                if attempt==2:
                    raise CatalogueError('Catalogue request failed after bounded retries') from None
                self.pause(2**attempt)
        raise CatalogueError('Catalogue request failed')

    def listing(self,lang,year,kind):
        if lang not in ('nl','en') or kind not in ('Programme','Course'):
            raise CatalogueError('Invalid catalogue language or kind')
        year=edition(year)
        self.check_stop()
        url=BASE+'/'+lang+'/Home/Search'
        form=BeautifulSoup(self.request('GET',url),'html.parser')
        token=form.select_one('input[name="__RequestVerificationToken"]')
        data={'Filters.SearchCriteria':'','Filters.FilterByType':kind,'Filters.SelectedSchoolYear':year}
        if token:
            data['__RequestVerificationToken']=token.get('value','')
        html=self.request('POST',url,data=data)
        rows={}
        clusters={}
        expected=None
        seen={url}
        for page in range(self.max_pages):
            found,count,next_url,options=parse_listing(html,lang,year,kind)
            if expected is not None and count!=expected:
                raise CatalogueError('Catalogue changed while paging; retry without replacing the saved version')
            expected=count
            rows.update(found)
            clusters.update((option['id'],option) for option in options)
            if len(rows)>expected:
                raise CatalogueError('Catalogue result count mismatch')
            if not next_url:
                if len(rows)!=expected:
                    raise CatalogueError('Incomplete catalogue listing: '+str(len(rows))+' of '+str(expected))
                return list(rows.values()),list(clusters.values())
            if next_url in seen:
                raise CatalogueError('Repeated catalogue pagination link')
            seen.add(next_url)
            html=self.request('GET',next_url)
        raise CatalogueError('Catalogue pagination safety limit reached; listing is not complete')

    def download(self,year,emit=None):
        year=edition(year)
        emit=emit or (lambda event:None)
        output={}
        for lang in ('nl','en'):
            programmes,clusters=self.listing(lang,year,'Programme')
            courses,course_clusters=self.listing(lang,year,'Course')
            if not programmes and not courses:
                raise CatalogueError('No published catalogue found for '+lang+' '+year)
            indexed={row['path']:dict(row) for row in courses}
            for index,row in enumerate(programmes):
                path=row['path']
                programme=parse_programme(self.request('GET',BASE+path),path,lang,year)
                for key in ('cluster','mode','level','language'):
                    programme[key]=row.get(key,'')
                row['programme']=programme
                for module in programme['modules']:
                    for course in module['courses']:
                        indexed.setdefault(course['path'],{'path':course['path'],'name':(course['code']+' '+course['name']).strip(),'cluster':row.get('cluster',''),'mode':'','level':'','language':''})
                emit({'lang':lang,'phase':'programmes','done':index+1,'total':len(programmes)})
            details={}
            for index,path in enumerate(indexed):
                details[path]=parse_course(self.request('GET',BASE+path),path,lang,year)
                emit({'lang':lang,'phase':'courses','done':index+1,'total':len(indexed)})
            stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
            for programme in programmes:
                programme['programme']['fetched']=stamp
            for course in details.values():
                course['fetched']=stamp
            options={item['id']:item for item in clusters+course_clusters}
            output[lang]={'year':year,'lang':lang,'results':programmes+list(indexed.values()),'courses':details,
                          'clusters':list(options.values()),'expectedProgrammes':len(programmes),'expectedListedCourses':len(courses),
                          'totalCourses':len(details),'complete':True,'failed':[],'fetched':stamp,'saved':stamp}
        return output
