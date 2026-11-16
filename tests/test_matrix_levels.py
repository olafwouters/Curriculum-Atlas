"""Python unittest runner for the Python app's matrix JavaScript contracts.

Requires Node for frontend logic checks; does not replace Flask or browser tests.
Run: python -m unittest discover -s tests -v
"""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
MARKER = "/* Domain rows and level cards for the original Python-backed interface. */"

@unittest.skipUnless(shutil.which("node"), "Node required for JavaScript contract checks")
class MatrixLevelsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = ROOT / "static" / "v9.js"
        text = cls.bundle.read_text(encoding="utf-8")
        if text.count(MARKER) != 1:
            raise AssertionError("Expected exactly one matrix extension")
        cls.source = MARKER + text.split(MARKER, 1)[1]

    def js(self, body):
        harness = """const fs=require('node:fs'),vm=require('node:vm');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const context={module:{exports:{}},structuredClone};
vm.runInNewContext(input.source,context);
const result=Function('api',input.body)(context.module.exports);
process.stdout.write(JSON.stringify(result));"""
        result = subprocess.run(["node", "-e", harness], input=json.dumps({"source": self.source, "body": body}), text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_entire_loaded_script_syntax(self):
        subprocess.run(["node", "--check", str(self.bundle)], check=True, capture_output=True)

    def test_domain_grouping_preserves_levels_and_order(self):
        result = self.js("const a=[{id:'a',domain:'D',level:'I'},{id:'b',domain:'X',level:'Custom'},{id:'c',domain:'D',level:'IV'}];return api.groups(a).map(g=>g.map(o=>o.id));")
        self.assertEqual(result, [["a", "c"], ["b"]])

    def test_all_key_shapes(self):
        result = self.js("return ['o|m','o|m::A%20B','o|m|A%20B'].map(k=>api.parse(k));")
        self.assertEqual(result[0]["mid"], "m")
        self.assertEqual(result[1]["code"], "A B")
        self.assertEqual(result[2]["code"], "A B")
        self.assertEqual(result[1]["ui"], "o|m|A%20B")

    def test_legacy_alias_preserved_and_ambiguity_rejected(self):
        result = self.js("const a=api.resolve({'o|m|A':{}},'o|m::A');let refused=false;try{api.resolve({'o|m|A':{},'o|m::A':{}},'o|m|A')}catch{refused=true}return {a,refused};")
        self.assertEqual(result, {"a": "o|m|A", "refused": True})

    def test_multiple_level_drafts_remain_independent(self):
        result = self.js("const s={modules:[{id:'m',courses:[]}],mappings:{}};return api.commit(s,[['o1|m',{evidence:'I draft'}],['o4|m',{evidence:'IV draft'}]]).mappings;")
        self.assertEqual(result["o1|m"]["evidence"], "I draft")
        self.assertEqual(result["o4|m"]["evidence"], "IV draft")

    def test_unknown_fields_unicode_and_course_identity(self):
        result = self.js("const s={modules:[{id:'m',courses:[{code:'A B'}]}],mappings:{'o|m':{evidence:'Module'},'o|m::A%20B':{extra:{keep:true}}},unknown:{keep:'één'}};const before=JSON.stringify(s),n=api.commit(s,[['o|m|A%20B',{evidence:'Vak'}]]);return {n,unchanged:before===JSON.stringify(s)};")
        self.assertTrue(result["unchanged"])
        n = result["n"]
        self.assertEqual(n["mappings"]["o|m"]["evidence"], "Module")
        self.assertEqual(n["mappings"]["o|m::A%20B"]["extra"], {"keep": True})
        self.assertNotIn("o|m|A%20B", n["mappings"])
        self.assertEqual(n["unknown"]["keep"], "één")
        self.assertEqual(n["schemaVersion"], 6)

    def test_invalid_later_draft_is_atomic(self):
        result = self.js("const s={modules:[{id:'m',courses:[]}],mappings:{}};const before=JSON.stringify(s);let refused=false;try{api.commit(s,[['o1|m',{evidence:'first'}],['o4|m',{testing:'elsewhere',elsewhere:'missing'}]])}catch{refused=true}return {refused,unchanged:before===JSON.stringify(s)};")
        self.assertEqual(result, {"refused": True, "unchanged": True})

    def test_status_dimensions_and_empty_apply(self):
        result = self.js("const s={modules:[{id:'m',courses:[]}],mappings:{'o|m':{status:'assessed'}}};return {a:api.commit(s,[['o|m',{phase:'mastery',review:'attention'}]]).mappings['o|m'],empty:api.commit(s,[])};")
        self.assertEqual(result["a"]["testing"], "summative")
        self.assertEqual(result["a"]["review"], "attention")
        self.assertEqual(result["a"]["status"], "practised")
        self.assertNotIn("schemaVersion", result["empty"])

if __name__ == "__main__":
    unittest.main()
