import sys,unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from atlas_catalogue_source import CatalogueError,CatalogueSource,detail_path,parse_listing

def listing(lang,kind,paths,count,more=''):
    rows=''.join('<div class="row"><a href="/'+lang+'/'+('Programme' if kind=='Programme' else 'course')+'/2026/'+p+'">'+p+'</a><span class="school">School</span></div>' for p in paths)
    return '<div id="search-results"><span class="result-count">'+str(count)+' results</span>'+rows+('<div class="more"><a href="'+more+'">More</a></div>' if more else '')+'</div>'

class CatalogueSourceTests(unittest.TestCase):
    def source(self,pages):
        source=CatalogueSource(pause=lambda delay:None)
        source.request=Mock(side_effect=pages)
        return source
    def test_pagination_accumulates_disjoint_pages(self):
        source=self.source(['<form/>',listing('nl','Programme',['A'],2,'/nl/Home/Search?page=2'),listing('nl','Programme',['B'],2)])
        rows,_=source.listing('nl','2026','Programme')
        self.assertEqual([r['name'] for r in rows],['A','B'])
    def test_cumulative_pages_are_deduplicated(self):
        source=self.source(['<form/>',listing('nl','Programme',['A'],2,'/nl/Home/Search?page=2'),listing('nl','Programme',['A','B'],2)])
        self.assertEqual(len(source.listing('nl','2026','Programme')[0]),2)
    def test_truncated_listing_is_not_complete(self):
        source=self.source(['<form/>',listing('nl','Programme',['A'],2)])
        with self.assertRaises(CatalogueError):source.listing('nl','2026','Programme')
    def test_repeated_page_is_rejected(self):
        page=listing('nl','Programme',['A'],2,'/nl/Home/Search?page=2')
        source=self.source(['<form/>',page,page])
        with self.assertRaises(CatalogueError):source.listing('nl','2026','Programme')
    def test_cross_host_pagination_is_rejected(self):
        with self.assertRaises(CatalogueError):parse_listing(listing('nl','Programme',['A'],2,'https://evil.example/nl/Home/Search'),'nl','2026','Programme')
    def test_cross_language_details_are_rejected(self):
        with self.assertRaises(CatalogueError):detail_path('/en/course/2026/A','nl','2026','Course')
    def test_changed_count_is_rejected(self):
        source=self.source(['<form/>',listing('nl','Programme',['A'],2,'/nl/Home/Search?page=2'),listing('nl','Programme',['B'],3)])
        with self.assertRaises(CatalogueError):source.listing('nl','2026','Programme')
    def test_unknown_layout_is_rejected(self):
        with self.assertRaises(CatalogueError):parse_listing('<html>Unavailable</html>','nl','2026','Course')
    def test_missing_count_is_rejected(self):
        with self.assertRaises(CatalogueError):parse_listing('<div id="search-results"></div>','nl','2026','Course')
    def test_cancelled_update_stops_before_network(self):
        session=Mock();source=CatalogueSource(session=session,stop=lambda:True)
        with self.assertRaises(CatalogueError):source.request('GET','https://catalogue.hanze.nl/nl/Home/Search')
        session.request.assert_not_called()
    def test_download_includes_both_languages_and_unlinked_courses(self):
        source=CatalogueSource()
        def index(lang,year,kind):
            code='P' if kind=='Programme' else 'UNLINKED'
            prefix='Programme' if kind=='Programme' else 'course'
            return [{'path':'/'+lang+'/'+prefix+'/2026/'+code,'name':code,'cluster':'School'}],[]
        source.listing=Mock(side_effect=index)
        def fetch(method,url):
            lang=url.split('/')[3]
            if '/Programme/' in url:
                return '<div class="programma"><h2>Programme</h2><div class="component"><h3>Jaar 1</h3><a href="/'+lang+'/course/2026/LINKED"><span>L</span><span>Linked</span><span class="credits">5</span></a></div></div>'
            return '<dl><dt>Code</dt><dd>Course</dd></dl><div class="col-md-6"><div class="row"><h2>Leeruitkomsten</h2></div><div class="row">Outcome</div></div>'
        source.request=Mock(side_effect=fetch)
        result=source.download('2026')
        self.assertEqual(set(result),{'nl','en'})
        for lang in ('nl','en'):
            self.assertTrue(result[lang]['complete'])
            self.assertEqual(result[lang]['totalCourses'],2)
            self.assertIn('/'+lang+'/course/2026/UNLINKED',result[lang]['courses'])
            self.assertIn('/'+lang+'/course/2026/LINKED',result[lang]['courses'])
            self.assertEqual(result[lang]['expectedListedCourses'],1)
    def test_english_failure_does_not_return_partial_bundle(self):
        source=CatalogueSource()
        source.listing=Mock(side_effect=[([],[]),([{'path':'/nl/course/2026/A','name':'A'}],[]),CatalogueError('English unavailable')])
        source.request=Mock(return_value='<dl><dt>Code</dt><dd>A</dd></dl>')
        with self.assertRaises(CatalogueError):source.download('2026')
    def test_invalid_edition_is_rejected(self):
        with self.assertRaises(CatalogueError):CatalogueSource().download('../2026')

    def test_retries_are_bounded(self):
        import requests
        session=Mock();session.request.side_effect=requests.Timeout('test timeout')
        source=CatalogueSource(session=session,pause=lambda delay:None)
        with self.assertRaises(CatalogueError):source.request('GET','https://catalogue.hanze.nl/nl/Home/Search')
        self.assertEqual(session.request.call_count,3)
    def test_redirect_is_not_followed(self):
        session=Mock();session.request.return_value.status_code=302
        source=CatalogueSource(session=session,pause=lambda delay:None)
        with self.assertRaises(CatalogueError):source.request('GET','https://catalogue.hanze.nl/nl/Home/Search')
        self.assertEqual(session.request.call_count,1)
        self.assertFalse(session.request.call_args.kwargs['allow_redirects'])
    def test_empty_programme_is_not_accepted(self):
        from atlas_catalogue_source import parse_programme
        with self.assertRaises(CatalogueError):parse_programme('<div class="programma"><h2>Empty</h2></div>','/nl/Programme/2026/P','nl','2026')
    def test_page_limit_does_not_claim_completeness(self):
        source=self.source(['<form/>',listing('nl','Programme',['A'],2,'/nl/Home/Search?page=2'),listing('nl','Programme',['B'],2)])
        source.max_pages=1
        with self.assertRaises(CatalogueError):source.listing('nl','2026','Programme')
    def test_invalid_language_stops_before_request(self):
        source=self.source([])
        with self.assertRaises(CatalogueError):source.listing('../en','2026','Programme')
        source.request.assert_not_called()

if __name__=='__main__':unittest.main()
