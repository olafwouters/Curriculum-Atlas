import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import atlas_supabase as store

class SnapshotRoutesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        folder = root / 'data' / 'catalogue-cache'
        folder.mkdir(parents=True)
        self.folder = folder
        self.programmes = {}
        self.courses = {}
        for lang in ('nl', 'en'):
            programme = f'/{lang}/Programme/2026/P1'
            course = f'/{lang}/course/2026/C1'
            self.programmes[lang] = programme
            self.courses[lang] = course
            data = {'complete': True, 'saved': 'stamp', 'clusters': [{'id': 's1', 'name': 'School'}], 'results': [{'path': programme, 'name': 'Test programme', 'cluster': 'School', 'programme': {'programme': 'Test', 'modules': [{'id': 'm1', 'courses': [{'code': 'C1', 'name': 'Test course', 'path': course}]}]}}], 'courses': {course: {'content': lang, 'outcomes': 'Learning'}}}
            (folder / f'{lang}-2026.json').write_text(json.dumps(data), encoding='utf-8')
        env = patch.dict(os.environ, {'VERCEL': '1', 'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test'}, clear=True)
        env.start()
        self.addCleanup(env.stop)
        self.app = Flask(__name__)
        self.legacy = {'ROOT': root, 'now': lambda: 'stamp', 'lib_seeds': lambda: []}
        store.install(self.app, self.legacy)
        self.http = self.app.test_client()
        self.headers = {'Authorization': 'Bearer user-jwt'}
        self.access = patch.object(store, 'rpc', return_value={'role': 'facilitator'})
        self.rpc = self.access.start()
        self.addCleanup(self.access.stop)
        network = patch.object(store.requests, 'request', side_effect=AssertionError('Unexpected HTTP request'))
        network.start()
        self.addCleanup(network.stop)

    def test_bilingual_search_and_details_are_read_only(self):
        before = {p.name: p.read_bytes() for p in self.folder.iterdir()}
        with patch.object(Path, 'write_text', side_effect=AssertionError('Unexpected write')):
            for lang in ('nl', 'en'):
                for kind in ('Programme', 'Course'):
                    r = self.http.post('/api/search', headers=self.headers, json={'lang': lang, 'kind': kind, 'cluster': 's1'})
                    self.assertEqual(r.status_code, 200)
                    self.assertEqual(r.json['total'], 1)
                    self.assertEqual(r.json['source'], 'snapshot')
                for route, path in (('programme', self.programmes[lang]), ('course', self.courses[lang])):
                    r = self.http.post('/api/' + route, headers=self.headers, json={'path': path})
                    self.assertEqual(r.status_code, 200)
                r = self.http.get('/api/catalogue-clusters?lang=' + lang, headers=self.headers)
                self.assertEqual(r.json['clusters'][0]['id'], 's1')
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.folder.iterdir()})

    def test_status_and_year_copy_use_json_without_meta(self):
        r = self.http.get('/api/catalogue-cache/status', headers=self.headers)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json['readOnly'])
        self.assertTrue(r.json['languages']['en']['complete'])
        structure, offline = self.legacy['structure_for'](self.programmes['nl'])
        self.assertTrue(offline)
        structure['modules'].clear()
        self.assertEqual(len(self.legacy['structure_for'](self.programmes['nl'])[0]['modules']), 1)

    def test_auth_and_approval_are_retained(self):
        self.assertEqual(self.http.post('/api/search', json={}).status_code, 401)
        self.rpc.side_effect = store.StoreError('Denied', 403)
        self.assertEqual(self.http.post('/api/search', headers=self.headers, json={}).status_code, 403)

    def test_cross_origin_is_denied(self):
        self.assertEqual(self.http.post('/api/search', headers={**self.headers, 'Origin': 'https://evil.example'}, json={}).status_code, 403)

    def test_missing_invalid_and_unavailable_snapshots(self):
        for values, status in (({'year': '../2026'}, 400), ({'lang': 'de'}, 400), ({'year': '2025'}, 404), ({'kind': 'Invalid'}, 400)):
            self.assertEqual(self.http.post('/api/search', headers=self.headers, json=values).status_code, status)
        self.assertEqual(self.http.post('/api/course', headers=self.headers, json={'path': 'https://evil.example'}).status_code, 400)
        self.assertEqual(self.http.post('/api/course', headers=self.headers, json={'path': '/nl/course/2026/MISSING'}).status_code, 404)
        (self.folder / 'nl-2026.json').write_text('{broken', encoding='utf-8')
        self.assertEqual(self.http.post('/api/search', headers=self.headers, json={}).status_code, 503)

    def test_incomplete_not_misrepresented(self):
        path = self.folder / 'nl-2026.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['complete'] = False
        path.write_text(json.dumps(data), encoding='utf-8')
        r = self.http.post('/api/search', headers=self.headers, json={})
        self.assertFalse(r.json['complete'])
        self.assertTrue(r.json['truncated'])

    def test_crawling_stays_disabled_and_workspace_reads_use_supabase(self):
        self.assertEqual(self.http.post('/api/catalogue-cache/start', headers=self.headers, json={}).status_code, 503)
        with patch.object(store, 'rows', return_value=[]) as rows:
            self.assertEqual(self.http.get('/api/workspaces', headers=self.headers).json, [])
            self.assertEqual(rows.call_args.args, ('workspaces',))

if __name__ == '__main__':
    unittest.main()
