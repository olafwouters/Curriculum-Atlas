"""Domain-navigation contracts. Run: python -m unittest discover -s tests -v."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

@unittest.skipUnless(shutil.which("node"), "Node required")
class DomainNavigationTests(unittest.TestCase):
    def js(self, body):
        text = (Path(__file__).resolve().parents[1] / "static/v9.js").read_text(encoding="utf-8")
        marker = "/* Domain rows and level cards for the original Python-backed interface. */"
        source = marker + text.split(marker, 1)[1]
        harness = """const vm=require('node:vm'),x=JSON.parse(require('node:fs').readFileSync(0,'utf8')),c={module:{exports:{}},structuredClone};vm.runInNewContext(x.source,c);process.stdout.write(JSON.stringify(Function('a',x.body)(c.module.exports)));"""
        result = subprocess.run(["node", "-e", harness], input=json.dumps({"source": source, "body": body}), text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_domain_routing_preserves_entity_and_level(self):
        self.assertEqual(self.js("const os=[{id:'a',domain:'A',level:'IV. Direction'},{id:'b',domain:'B',level:'I. Start'},{id:'c',domain:'B',level:'IV — Direction'}];return ['a|m','a|m::A%20B','a|m|A%20B'].map(k=>a.domainRoute(os,k,'B'));"), ["c|m", "c|m|A%20B", "c|m|A%20B"])

    def test_remembers_level_and_ignores_stale_choice(self):
        self.assertEqual(self.js("const os=[{id:'a',domain:'A',level:'I. Start'},{id:'b',domain:'B',level:'I. Start'},{id:'c',domain:'B',level:'IV. Direction'}];return ['c','removed','a'].map(id=>a.domainRoute(os,'a|m','B',new Map([['B',id]])));"), ["c|m", "b|m", "b|m"])

    def test_custom_levels_fallback_and_unknown_domain(self):
        self.assertEqual(self.js("const os=[{id:'a',domain:'A',level:'Custom'},{id:'b',domain:'B',level:'Other'}];let refused=false;try{a.domainRoute(os,'a|m','Missing')}catch{refused=true}return [a.domainRoute(os,'a|m','B'),refused];"), ["b|m", True])

    def test_shared_icon_identity_and_custom_fallback(self):
        self.assertEqual(self.js("const ds=['A','B','C','D','E'];return [...ds.map(d=>a.iconName(d,ds)),a.iconName('A',ds,true),a.iconName('Other',ds)];"), ["search", "chat", "pencil", "shield", "gear", "grid", "grid"])

    def test_svg_is_local_accessible_and_not_interpolated(self):
        result = self.js("return ['search','chat','pencil','shield','gear','grid','<script>','toString'].map(k=>a.iconSvg(k));")
        for svg in result:
            self.assertIn('aria-hidden="true"', svg)
            self.assertIn('focusable="false"', svg)
            self.assertNotIn('<script>', svg)
            self.assertNotIn('http', svg)

    def test_cross_domain_course_drafts_are_atomic(self):
        self.assertEqual(self.js("const s={modules:[{id:'m',courses:[{code:'A B'}]}],mappings:{'a|m':{evidence:'Module'},'b|m::A%20B':{extra:'keep'}}};const before=JSON.stringify(s),n=a.commit(s,[['a|m|A%20B',{evidence:'Domain A'}],['b|m|A%20B',{evidence:'Domain B'}]]);let refused=false;try{a.commit(s,[['a|m',{evidence:'First'}],['b|m',{testing:'elsewhere',elsewhere:'missing'}]])}catch{refused=true}return [n.mappings['a|m'].evidence,n.mappings['a|m::A%20B'].evidence,n.mappings['b|m::A%20B'].extra,JSON.stringify(s)===before,refused];"), ["Module", "Domain A", "keep", True, True])

if __name__ == "__main__":
    unittest.main()
