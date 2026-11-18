import copy, json, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask
import atlas_supabase as store
import atlas_programme_routes as routes

class ProgrammeRouteTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        root = Path(temp.name); folder = root / 'data/catalogue-cache'; folder.mkdir(parents=True)
        (root / 'static').mkdir()
        (root / 'static/index.html').write_text('<body><script src="/static/app.js"></script></body>')
        self.path = '/en/Programme/2026/P1'; self.course = '/en/course/2026/C1'
        self.programme = {'programme': 'Test', 'edition': '2026', 'source': 'https://catalogue.hanze.nl' + self.path, 'modules': [{'id': 'm1', 'name': 'Block', 'year': 1, 'courses': [{'code': 'C1', 'path': self.course}]}]}
        self.detail = {'metadata': {}, 'content': 'Content', 'outcomes': 'Outcomes', 'source': 'https://catalogue.hanze.nl' + self.course, 'fetched': 'stamp'}
        (folder / 'en-2026.json').write_text(json.dumps({'results': [{'path': self.path, 'programme': self.programme}], 'courses': {self.course: self.detail}}))
        env = patch.dict(os.environ, {'VERCEL': '1', 'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test'}, clear=True); env.start(); self.addCleanup(env.stop)
        self.app = Flask(__name__); self.app.add_url_rule('/', 'home', lambda: '')
        store.install(self.app, {'app': self.app, 'ROOT': root, 'now': lambda: 'stamp', 'lib_seeds': lambda: []})
        self.http = self.app.test_client(); self.headers = {'Authorization': 'Bearer user-jwt', 'Origin': 'http://localhost'}
        access = patch.object(store, 'rpc', return_value={'id': 'u1', 'role': 'facilitator'}); self.rpc = access.start(); self.addCleanup(access.stop)

    def post(self, suffix, data):
        return self.http.post('/api/programme/' + suffix, headers=self.headers, json=data)

    def test_auth_and_origin(self):
        self.assertEqual(self.http.post('/api/programme/compare', json={}).status_code, 401)
        self.assertEqual(self.http.post('/api/programme/compare', headers={**self.headers, 'Origin': 'https://evil.example'}, json={}).status_code, 403)
        self.rpc.side_effect = store.StoreError('Denied', 403)
        self.assertEqual(self.post('compare', {'path': self.path}).status_code, 403)

    def test_compare_fetches_only_structure(self):
        with patch.object(routes, 'fetch_detail', return_value=copy.deepcopy(self.programme)) as fetch:
            response = self.post('compare', {'path': self.path})
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json['comparison']['changed'])
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(fetch.call_args.args[:2], (self.path, 'Programme'))

    def test_course_membership_and_incomplete_import(self):
        with patch.object(routes, 'fetch_detail') as fetch:
            self.assertEqual(self.post('course-details', {'programme': self.programme, 'path': '/en/course/2026/OTHER', 'source': 'online'}).status_code, 400)
            fetch.assert_not_called()
        data = {'programme': self.programme, 'source': 'online', 'details': {}}
        self.assertEqual(self.post('prepare-import', data).status_code, 409)
        response = self.post('prepare-import', {**data, 'allowIncomplete': True})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json['state']['catalogueImport']['complete'])

    def test_saved_import_does_not_fetch_or_save(self):
        with patch.object(routes, 'fetch_detail', side_effect=AssertionError('Unexpected live call')):
            response = self.post('prepare-import', {'programme': self.programme, 'source': 'saved'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['state']['courseDetails'][self.course]['content'], 'Content')
        self.assertTrue(all(call.args == ('atlas_access',) for call in self.rpc.call_args_list))
        response = self.http.get('/')
        self.assertIn('/static/programme-import.js?v=20261118', response.text)
        self.assertIn('/static/atlas-auth.js', response.text)

if __name__ == '__main__':
    unittest.main()
