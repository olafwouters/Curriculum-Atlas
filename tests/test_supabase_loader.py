import sys,unittest,uuid
from pathlib import Path
from unittest.mock import patch
from flask import Flask
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import atlas_supabase as store

class LoaderBindingTests(unittest.TestCase):
 def setUp(self):
  self.legacy={};self.load=store.install(Flask(__name__),self.legacy)
  self.wid=str(uuid.uuid4())
 def test_returns_installed_callable(self):
  self.assertTrue(callable(self.load))
  self.assertIs(self.load,self.legacy['load_workspace_state'])
 def test_loads_only_active_workspace(self):
  state={'programme':'Loader regression','modules':[]}
  with patch.object(store,'rows',return_value=[{'state':state}]) as rows:
   self.assertEqual(self.load(self.wid),state)
  rows.assert_called_once_with('workspaces',id='eq.'+self.wid,select='*',order='id.asc',deleted_at='is.null')
 def test_missing_workspace_is_404(self):
  with patch.object(store,'rows',return_value=[]):
   with self.assertRaises(store.StoreError) as error:self.load(self.wid)
  self.assertEqual(error.exception.status,404)
 def test_invalid_id_is_400(self):
  with self.assertRaises(store.StoreError) as error:self.load('not-a-uuid')
  self.assertEqual(error.exception.status,400)

if __name__=='__main__':unittest.main()
