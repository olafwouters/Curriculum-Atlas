import base64,json,sys,unittest
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from atlas_catalogue_worker import CatalogueWorker,WorkerRPC,WorkerError

VERSION='10000000-0000-0000-0000-000000000010'
class WorkerTests(unittest.TestCase):
 def setUp(self):
  self.tasks=[];self.calls=[];self.published=False
  self.source=Mock();self.source.stop=lambda:False
  self.source.listing.return_value=([{'path':'/nl/course/2026/A'}],[])
  self.parsers={'course':Mock(return_value={'source':'https://catalogue.hanze.nl/nl/course/2026/A'}),'programme':Mock()}
  def rpc(name,**args):
   action=args['p_action'];self.calls.append((action,args))
   if action=='claim':return {'task':self.tasks[0] if self.tasks else None}
   if action in ('finish','index_done','verify'):self.tasks.pop(0)
   if action=='publish':self.published=True
   return {'version':VERSION,'status':'published' if self.published else 'building'}
  self.rpc=Mock(side_effect=rpc)
  self.worker=CatalogueWorker(self.rpc,self.source,self.parsers)
 def task(self,kind,path='A'):
  return {'lang':'nl','kind':kind,'path':'/nl/course/2026/'+path,'summary':{}}
 def test_bounded_slice_and_resume(self):
  self.tasks=[self.task('course'),self.task('course','B')]
  self.worker.run('2026',VERSION,1)
  self.assertFalse(self.published);self.assertEqual(len(self.tasks),1)
  self.worker.run('2026',VERSION,2)
  self.assertTrue(self.published);self.assertEqual(self.source.request.call_count,2)
 def test_error_keeps_task_pending(self):
  self.tasks=[self.task('course')];self.source.request.side_effect=RuntimeError('source unavailable')
  with self.assertRaises(RuntimeError):self.worker.run('2026',VERSION)
  self.assertFalse(self.published);self.assertEqual(len(self.tasks),1)
  self.assertTrue(self.calls[-1][1]['p_data']['error'])
 def test_stopped_worker_does_not_claim(self):
  self.worker.run('2026',VERSION,stop=lambda:True)
  self.assertNotIn('claim',[x[0] for x in self.calls]);self.assertFalse(self.published)
  self.assertNotIn('release',[x[0] for x in self.calls])
 def test_index_upload_is_batched(self):
  self.tasks=[self.task('indexCourse')]
  self.source.listing.return_value=([{'path':'/nl/course/2026/C'+str(i)} for i in range(201)],[])
  self.worker.run('2026',VERSION,1)
  self.assertEqual([len(a['p_data']['rows']) for n,a in self.calls if n=='enqueue'],[100,100,1])
 def test_verify_does_not_upload(self):
  self.tasks=[self.task('verifyCourse')];self.worker.run('2026',VERSION,1)
  self.assertIn('verify',[x[0] for x in self.calls]);self.assertNotIn('enqueue',[x[0] for x in self.calls])
 def test_path_escape_rejected(self):
  self.tasks=[self.task('course','../escape')]
  with self.assertRaises(WorkerError):self.worker.run('2026',VERSION)
  self.source.request.assert_not_called()
 def test_stop_callback_restored(self):
  original=self.source.stop;self.worker.run('2026',VERSION)
  self.assertIs(self.source.stop,original)
 def test_publishable_key_rejected(self):
  with self.assertRaises(WorkerError):WorkerRPC('https://'+'a'*20+'.supabase.co','sb_publishable_dummy')
 def test_cross_host_worker_rpc_rejected(self):
  with self.assertRaises(WorkerError):WorkerRPC('https://example.org','bad')

if __name__=='__main__':unittest.main()
