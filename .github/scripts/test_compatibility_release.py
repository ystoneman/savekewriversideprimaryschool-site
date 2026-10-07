"""Release gates prevent unchecked, partial and stale compatibility publication."""
import copy
import unittest
from unittest.mock import patch
import compatibility_release as release

class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.sha='a'*40
  self.run={'id':10,'head_sha':self.sha,'head_branch':'main','event':'push','path':'.github/workflows/pages.yml'}
  self.jobs=[{'name':n,'conclusion':'success'} for n in ['validate','browser-tests','deploy']]
 def test_failed_or_missing_gate_and_non_main_ref_are_rejected(self):
  release.checked_run(self.run,self.jobs,self.sha)
  for name in ['validate','browser-tests','deploy']:
   jobs=copy.deepcopy(self.jobs);next(j for j in jobs if j['name']==name)['conclusion']='failure'
   with self.assertRaises(ValueError):release.checked_run(self.run,jobs,self.sha)
  for key,value in [('event','pull_request'),('head_branch','candidate'),('head_sha','b'*40),('path','unrelated.yml')]:
   run=dict(self.run);run[key]=value
   with self.assertRaises(ValueError):release.checked_run(run,self.jobs,self.sha)
 def test_newer_deployed_revision_rejects_old_retry(self):
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[{'id':11},{'id':10}]},{'jobs':self.jobs}]
  with patch.object(release,'request',side_effect=responses):
   with self.assertRaisesRegex(ValueError,'supersedes'):release.guard(self.sha,10)
 def test_failed_newer_deployment_does_not_block_valid_recovery(self):
  failed=[{'name':'deploy','conclusion':'failure'}]
  with patch.object(release,'request',side_effect=[self.run,{'jobs':self.jobs},{'workflow_runs':[{'id':11},{'id':10}]},{'jobs':failed}]):
   self.assertEqual(release.guard(self.sha,10),self.run)
 def test_changed_or_removed_item_changes_digest(self):
  before={'letters.json':'a'*64,'supporters.json':'b'*64}
  after={'letters.json':'c'*64,'supporters.json':'b'*64}
  self.assertNotEqual(release.digest(before),release.digest(after))
  self.assertNotEqual(release.digest(before),release.digest({'letters.json':'a'*64}))
 def test_partial_copy_cannot_be_claimed_as_complete(self):
  record={'digest':'correct','files':{'letters.json':'a'*64}}
  with patch.object(release,'remote_record',return_value={'digest':'stale','files':record['files']}):
   with self.assertRaises(ValueError):release.verify('https://example.invalid/',record)
 def synchronize_fixture(self,responses,current=None):
  record={'digest':'checked','files':{'letters.json':'a'*64}}
  return (patch.object(release,'guard'),patch.object(release,'prepare',return_value=record),patch.object(release,'remote_record',return_value=current),patch.object(release,'request',side_effect=responses),patch.object(release,'verify'))
 def child_run(self,conclusion='success',sha=None):
  return {'display_title':'Compatibility '+(sha or self.sha),'event':'workflow_dispatch','head_branch':'main','path':'.github/workflows/pages.yml','status':'completed','conclusion':conclusion}
 def test_unchanged_bundle_is_verified_without_dispatch(self):
  from contextlib import ExitStack
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([],{'digest':'checked'})]
   release.synchronize(self.sha,10)
   mocks[3].assert_not_called();self.assertEqual(mocks[4].call_count,4)
 def test_retry_follows_new_dispatch_ids_and_reports_partial_failure(self):
  from contextlib import ExitStack
  for ids,conclusion in [((20,21),'failure'),((30,31),'success')]:
   responses=[{'workflow_run_id':ids[0]},{'workflow_run_id':ids[1]},self.child_run(),self.child_run(conclusion)]
   with ExitStack() as stack:
    mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
    if conclusion=='failure':
     with self.assertRaisesRegex(ValueError,'deployment failed'):release.synchronize(self.sha,10)
     self.assertEqual(mocks[4].call_count,1)
    else:
     release.synchronize(self.sha,10);self.assertEqual(mocks[4].call_count,4)
    polled=[call.args[0] for call in mocks[3].call_args_list if '/actions/runs/' in call.args[0]]
    self.assertEqual([url.rsplit('/',1)[-1] for url in polled],list(map(str,ids)))
 def test_dispatch_without_exact_run_id_cannot_claim_success(self):
  from contextlib import ExitStack
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([None])]
   with self.assertRaisesRegex(ValueError,'exact workflow run ID'):release.synchronize(self.sha,10)
   mocks[4].assert_not_called()
 def test_wrong_dispatched_revision_cannot_claim_success(self):
  from contextlib import ExitStack
  responses=[{'workflow_run_id':20},{'workflow_run_id':21},self.child_run(sha='b'*40)]
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
   with self.assertRaisesRegex(ValueError,'does not match'):release.synchronize(self.sha,10)
   mocks[4].assert_not_called()
