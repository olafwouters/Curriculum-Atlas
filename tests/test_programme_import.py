import copy
import unittest
from unittest.mock import patch
from atlas_programme_import import ProgrammeImportError, identity, course_paths, compare_structures, build_workspace

class ProgrammeImportTests(unittest.TestCase):
    def setUp(self):
        self.path = '/en/course/2026/C1'
        self.programme = {'programme': 'Test', 'edition': '2026', 'source': 'https://catalogue.hanze.nl/en/Programme/2026/P1', 'fetched': 'old', 'modules': [{'id': 'm1', 'name': 'Block', 'year': 1, 'ects': '5', 'courses': [{'code': 'C1', 'name': 'Course', 'ects': '5', 'path': self.path}]}], 'mappings': {'old': {}}, 'targets': {'old': {}}}
        self.detail = {'metadata': {'Name': 'Course'}, 'outcomes': 'Outcomes', 'content': 'Content', 'source': 'https://catalogue.hanze.nl' + self.path, 'fetched': 'stamp'}

    def test_timestamps_and_generated_ids_do_not_count_as_changes(self):
        online = copy.deepcopy(self.programme)
        online['fetched'] = 'new'
        online['modules'][0]['id'] = 'new-id'
        self.assertFalse(compare_structures(self.programme, online)['changed'])

    def test_credit_changes_are_detected(self):
        online = copy.deepcopy(self.programme)
        online['modules'][0]['courses'][0]['ects'] = '10'
        self.assertTrue(compare_structures(self.programme, online)['changed'])

    def test_reordered_references_are_detected(self):
        old = copy.deepcopy(self.programme)
        old['modules'][0]['courses'].append({'code': 'C2', 'path': '/en/course/2026/C2'})
        new = copy.deepcopy(old)
        new['modules'][0]['courses'].reverse()
        self.assertTrue(compare_structures(old, new)['changed'])

    def test_deduplicate_course_fetches_but_preserve_references(self):
        self.programme['modules'][0]['courses'] *= 2
        self.assertEqual(course_paths(self.programme), [self.path])
        online = copy.deepcopy(self.programme)
        online['modules'][0]['courses'].pop()
        self.assertEqual(compare_structures(self.programme, online)['courseReferencesRemoved'], [self.path])

    def test_different_programme_is_refused(self):
        online = copy.deepcopy(self.programme)
        online['source'] = online['source'].replace('P1', 'P2')
        with self.assertRaises(ProgrammeImportError): compare_structures(self.programme, online)

    def test_different_edition_is_refused(self):
        online = copy.deepcopy(self.programme)
        online['edition'] = '2025'
        with self.assertRaises(ProgrammeImportError): compare_structures(self.programme, online)

    def test_untrusted_source_is_refused(self):
        for source in ('https://evil.example/en/Programme/2026/P1', '//evil.example/en/Programme/2026/P1', 'http://catalogue.hanze.nl/en/Programme/2026/P1', '/en/Programme/2026/P1?url=x'):
            with self.subTest(source=source), self.assertRaises(ProgrammeImportError): identity(source)

    def test_cross_language_course_is_refused(self):
        self.programme['modules'][0]['courses'][0]['path'] = '/nl/course/2026/C1'
        with self.assertRaises(ProgrammeImportError): course_paths(self.programme)

    def test_complete_workspace_copies_course_content_and_resets_mappings(self):
        state = build_workspace(self.programme, {self.path: self.detail}, 'online', 'stamp')
        self.assertTrue(state['catalogueImport']['complete'])
        self.assertEqual(state['courseDetails'][self.path]['outcomes'], 'Outcomes')
        self.assertEqual(state['mappings'], {})
        self.assertEqual(state['targets'], {})
        self.assertIn('old', self.programme['mappings'])
        state['courseDetails'][self.path]['content'] = 'Changed'
        self.assertEqual(self.detail['content'], 'Content')

    def test_missing_requires_explicit_permission(self):
        with self.assertRaises(ProgrammeImportError): build_workspace(self.programme, {}, 'online', 'stamp')
        state = build_workspace(self.programme, {}, 'online', 'stamp', allow_incomplete=True)
        self.assertFalse(state['catalogueImport']['complete'])
        self.assertEqual(state['catalogueImport']['missingCourses'], [self.path])

    def test_empty_source_sections_are_not_network_failures(self):
        self.detail.update(outcomes='', content='')
        self.assertTrue(build_workspace(self.programme, {self.path: self.detail}, 'online', 'stamp')['catalogueImport']['complete'])

    def test_unrelated_courses_are_not_embedded(self):
        state = build_workspace(self.programme, {self.path: self.detail, '/en/course/2026/OTHER': {}}, 'saved', 'stamp')
        self.assertEqual(list(state['courseDetails']), [self.path])

    def test_incorrect_course_source_is_refused(self):
        self.detail['source'] = 'https://catalogue.hanze.nl/en/course/2026/OTHER'
        with self.assertRaises(ProgrammeImportError): build_workspace(self.programme, {self.path: self.detail}, 'online', 'stamp')

    def test_empty_curriculum_is_refused(self):
        self.programme['modules'] = []
        with self.assertRaises(ProgrammeImportError): course_paths(self.programme)

    def test_size_guard_and_immutable_inputs(self):
        with patch('atlas_programme_import.MAX_WORKSPACE_BYTES', 10):
            with self.assertRaises(ProgrammeImportError): build_workspace(self.programme, {self.path: self.detail}, 'online', 'stamp')
        self.assertNotIn('courseDetails', self.programme)

if __name__ == '__main__':
    unittest.main()
