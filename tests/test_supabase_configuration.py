import ast,os,unittest
from pathlib import Path
from unittest.mock import patch

class ConfigurationTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  source=(Path(__file__).resolve().parents[1]/'atlas_supabase.py').read_text()
  tree=ast.parse(source)
  nodes=[n for n in tree.body if isinstance(n,(ast.ClassDef,ast.FunctionDef)) and n.name in ('StoreError','configuration')]
  namespace={'os':os}
  exec(compile(ast.Module(body=nodes,type_ignores=[]),'configuration_under_test','exec'),namespace)
  cls.read=staticmethod(namespace['configuration']);cls.error=namespace['StoreError']
 def check_error(self,env,expected):
  with patch.dict(os.environ,env,clear=True):
   with self.assertRaises(self.error) as caught:self.read()
  message=str(caught.exception)
  self.assertIn(expected,message);self.assertIn('Local fallback remains disabled',message)
  for value in env.values():
   if value:self.assertNotIn(value,message)
  return message
 def test_both_missing(self):
  message=self.check_error({},'SUPABASE_URL is missing')
  self.assertIn('SUPABASE_PUBLISHABLE_KEY is missing',message)
 def test_only_url_missing(self):
  self.check_error({'SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'},'SUPABASE_URL is missing')
 def test_only_key_missing(self):
  self.check_error({'SUPABASE_URL':'https://example.supabase.co'},'SUPABASE_PUBLISHABLE_KEY is missing')
 def test_label_is_not_key(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'SUPABASE_PUBLISHABLE_KEY'},clear=True):
   with self.assertRaises(self.error) as caught:self.read()
  self.assertIn('must contain the actual',str(caught.exception))
 def test_legacy_key_rejected_without_leak(self):
  self.check_error({'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'eyJ_private_example'},'must contain the actual')
 def test_secret_key_rejected_without_leak(self):
  self.check_error({'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_secret_private_example'},'must contain the actual')
 def test_dashboard_url_rejected(self):
  self.check_error({'SUPABASE_URL':'https://supabase.com/dashboard/project/example','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'},'HTTPS project API root')
 def test_url_credentials_never_leaked(self):
  self.check_error({'SUPABASE_URL':'https://user:private_password@example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'},'HTTPS project API root')
 def test_quoted_key_rejected(self):
  self.check_error({'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'"sb_publishable_private_example"'},'must contain the actual')
 def test_whitespace_normalized(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'  https://example.supabase.co/ \n','SUPABASE_PUBLISHABLE_KEY':'  sb_publishable_test \n'},clear=True):
   self.assertEqual(self.read(),('https://example.supabase.co','sb_publishable_test'))
 def test_valid_configuration(self):
  with patch.dict(os.environ,{'SUPABASE_URL':'https://example.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_test'},clear=True):
   self.assertEqual(self.read(),('https://example.supabase.co','sb_publishable_test'))

if __name__=='__main__':unittest.main()
