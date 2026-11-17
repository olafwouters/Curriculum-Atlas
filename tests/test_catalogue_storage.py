import sys,unittest,uuid
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from atlas_catalogue_storage import CatalogueStorage

class CatalogueStorageTests(unittest.TestCase):
 def setUp(self):
  self.version=str(uuid.uuid4());self.rpc=Mock(return_value={'version':self.version,'status':'building'});self.store=CatalogueStorage(self.rpc)
 def test_begin_uses_explicit_version(self):
  self.store.begin('2026',self.version)
  self.rpc.assert_called_once_with('atlas_catalogue_write',p_action='begin',p_version=self.version,p_edition='2026',p_data={})
 def test_count_bounded_batches(self):
  self.store.put(self.version,[{'n':n} for n in range(201)])
  self.assertEqual([len(c.kwargs['p_data']['entries']) for c in self.rpc.call_args_list],[100,100,1])
 def test_byte_bounded_batches(self):
  self.store.put(self.version,[{'text':'x'*1800000}]*2)
  self.assertEqual(self.rpc.call_count,2)
 def test_read_pins_version(self):
  self.store.read('2026','en',offset=100,version=self.version)
  self.assertEqual(self.rpc.call_args.kwargs['p_version'],self.version)
 def test_one_language_cannot_publish(self):
  with self.assertRaises(ValueError):self.store.publish(self.version,{'nl':{}})
  self.rpc.assert_not_called()
 def test_invalid_language(self):
  with self.assertRaises(ValueError):self.store.read('2026','de')
  self.rpc.assert_not_called()
 def test_invalid_year(self):
  with self.assertRaises(ValueError):self.store.begin('../2026')
  self.rpc.assert_not_called()
 def test_no_publish_after_upload_failure(self):
  bundle={}
  for lang in ('nl','en'):
   path='/'+lang+'/course/2026/A'
   bundle[lang]={'year':'2026','lang':lang,'complete':True,'failed':[],'results':[{'path':path,'name':'A'}],'courses':{path:{'source':'https://catalogue.hanze.nl'+path}},'expectedProgrammes':0,'totalCourses':1,'expectedListedCourses':1,'clusters':[]}
  def rpc(name,**args):
   if args['p_action']=='begin':return {'version':self.version,'status':'building'}
   if args['p_action']=='put':raise RuntimeError('upload failed')
   raise AssertionError('must not publish')
  self.store.rpc=Mock(side_effect=rpc)
  with self.assertRaises(RuntimeError):self.store.upload_bundle(bundle,self.version)
  self.assertEqual([c.kwargs['p_action'] for c in self.store.rpc.call_args_list],['begin','put'])

if __name__=='__main__':unittest.main()
