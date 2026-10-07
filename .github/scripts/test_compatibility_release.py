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
