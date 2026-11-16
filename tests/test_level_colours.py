"""Python-run colour contracts; not a real-browser rendering test.

Run: python -m unittest discover -s tests -v
"""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
MARKER = "/* Atlas level colours: presentation only; framework data stays unchanged. */"

@unittest.skipUnless(shutil.which("node"), "Node required for frontend colour contracts")
class LevelColourTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = ROOT / "static/v8.js"
        text = cls.bundle.read_text(encoding="utf-8")
        if text.count(MARKER) != 1:
            raise AssertionError("Expected one colour extension")
        cls.source = MARKER + text.split(MARKER, 1)[1]

    def js(self, body):
        harness = """const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const context={module:{exports:{}}};
require('node:vm').runInNewContext(input.source,context);
process.stdout.write(JSON.stringify(Function('api','source','vm',input.body)(context.module.exports,input.source,require('node:vm'))));"""
        result = subprocess.run(["node", "-e", harness], input=json.dumps({"source": self.source, "body": body}), text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def test_complete_bundle_syntax(self):
        subprocess.run(["node", "--check", str(self.bundle)], capture_output=True, check=True)

    def test_gold_matches_sampled_reference(self):
        self.assertEqual(self.js("return api.palette('#F7CF59');"), ["#fef5d1", "#fde69a", "#fbd161", "#e2ac2a"])

    def test_domains_get_progressively_darker_tints(self):
        results = self.js("return ['#5B8DC5','#EAA03F','#619E54','#E1776B','#8E6BBF'].map(base=>({base:base.toLowerCase(),p:api.palette(base),l:api.palette(base).map(api.luminance)}));")
        for item in results:
            self.assertEqual(item["p"][-1], item["base"])
            self.assertTrue(all(a > b for a, b in zip(item["l"], item["l"][1:])))

    def test_text_contrast_for_standard_and_custom_colours(self):
        ratios = self.js("return ['#F7CF59','#5B8DC5','#EAA03F','#619E54','#E1776B','#000','#fff','#777','#123456'].flatMap(c=>api.palette(c).map(bg=>api.contrast(bg,api.ink(bg))));")
        self.assertTrue(all(ratio >= 4.5 for ratio in ratios))

    def test_level_comes_from_label_not_card_position(self):
        self.assertEqual(self.js("return ['IV. Richting geven','I. Starten','III — Verdiepen','II. Apply','Eigen niveau'].map(x=>api.levelIndex(x,2));"), [3, 0, 2, 1, 2])

    def test_colours_are_applied_after_dialog_cards_exist(self):
        result = self.js("const cards=[],queue=[],styles=[];const host={open:true,querySelectorAll:()=>cards};const ctx={document:{createElement:()=>({}),head:{append:s=>styles.push(s.textContent)},getElementById:()=>host},F:[{id:'yellow',color:'#F7CF59',level:'I. Starten'},{id:'blue',color:'#5B8DC5',level:'IV. Richting geven'}],dialog:()=>42,queueMicrotask:fn=>queue.push(fn)};vm.runInNewContext(source,ctx);const returned=ctx.dialog('Constructive alignment');for(const id of ['yellow','blue'])cards.push({querySelector:()=>({value:id}),style:{setProperty(k,v){this[k]=v;}}});queue.forEach(fn=>fn());return {returned,styleCount:styles.length,colours:cards.map(c=>c.style['--atlas-level-fill'])};")
        self.assertEqual(result, {"returned": 42, "styleCount": 1, "colours": ["#fef5d1", "#5b8dc5"]})

    def test_invalid_colour_uses_safe_fallback(self):
        self.assertEqual(self.js("return api.palette('url(unsafe)')[3];"), "#64748b")

if __name__ == "__main__":
    unittest.main()
