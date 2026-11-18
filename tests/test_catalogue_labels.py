import shutil
import subprocess
import unittest
from pathlib import Path

SCRIPT = r'''
const assert = require('node:assert/strict');
const callbacks = [];
let language = 'nl';
class Button {
 constructor(path) { this.dataset = {path}; this.textContent = ''; this.attributes = new Map(); this.onclick = () => 'retained'; this.value = 'retained'; }
 hasAttribute(name) { return this.attributes.has(name); }
 setAttribute(name, value) { this.attributes.set(name, value); }
}
let local = new Button(), online = new Button();
let programme = new Button('/nl/Programme/2026/P1'), course = new Button('/en/course/2026/C1');
const form = {querySelector: selector => selector.includes('local') ? local : online};
const view = {querySelector: selector => selector === '#searchForm' ? form : null, querySelectorAll: () => [programme, course]};
global.document = {readyState: 'loading', getElementById: () => view, documentElement: {}, addEventListener: () => {}};
global.localStorage = {getItem: () => language};
global.MutationObserver = class { constructor(callback) {callbacks.push(callback);} observe() {} };
require('node:vm').runInThisContext(require('node:fs').readFileSync(process.argv[1], 'utf8'));
assert.equal(programme.textContent, 'Bekijk curriculum');
assert.equal(local.textContent, 'Zoek lokale onderwijscatalogus');
language = 'en'; callbacks.forEach(fn => fn());
assert.equal(programme.textContent, 'View curriculum');
assert.equal(course.textContent, 'View course');
assert.equal(local.textContent, 'Search saved course catalogue');
assert.equal(online.textContent, 'Search online course catalogue');
assert.equal(local.value, 'retained');
assert.equal(local.onclick(), 'retained');
assert.ok(local.hasAttribute('data-no-translate'));
programme = new Button('/en/Programme/2026/P2'); callbacks[0]();
assert.equal(programme.textContent, 'View curriculum');
language = 'nl'; callbacks.forEach(fn => fn());
assert.equal(programme.textContent, 'Bekijk curriculum');
assert.equal(course.textContent, 'Bekijk vak');
assert.equal(local.textContent, 'Zoek lokale onderwijscatalogus');
'''

class CatalogueLabelTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node.js is required for DOM-stub label tests')
    def test_bilingual_labels_after_rerender_preserve_actions(self):
        path = Path(__file__).resolve().parents[1] / 'static' / 'unified-controls.js'
        result = subprocess.run(['node', '-e', SCRIPT, str(path)], capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

if __name__ == '__main__':
    unittest.main()
