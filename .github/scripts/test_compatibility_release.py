"""Release gates prevent unchecked, partial and stale compatibility publication."""
import copy
import unittest
import io
import os
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
from unittest.mock import patch
import compatibility_release as release

class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.sha='a'*40
  self.run={'id':10,'head_sha':self.sha,'head_branch':'main','event':'push','path':'.github/workflows/pages.yml'}
  self.jobs=[{'name':n,'conclusion':'success'} for n in ['validate','browser-tests','deploy']]
  self.jobs[-1]['steps']=[{'name':'Deploy validated artifact','conclusion':'success'}]
 def candidate(self,run_id):
  return dict(self.run,id=run_id)
 def test_failed_or_missing_gate_and_non_main_ref_are_rejected(self):
  release.checked_run(self.run,self.jobs,self.sha)
  for name in ['validate','browser-tests','deploy']:
   jobs=copy.deepcopy(self.jobs);next(j for j in jobs if j['name']==name)['conclusion']='failure'
   with self.assertRaises(ValueError):release.checked_run(self.run,jobs,self.sha)
  for key,value in [('event','pull_request'),('head_branch','candidate'),('head_sha','b'*40),('path','unrelated.yml')]:
   run=dict(self.run);run[key]=value
   with self.assertRaises(ValueError):release.checked_run(run,self.jobs,self.sha)
 def test_newer_deployed_revision_rejects_old_retry(self):
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(11),self.candidate(10)]},{'jobs':self.jobs}]
  with patch.object(release,'request',side_effect=responses):
   with self.assertRaisesRegex(ValueError,'supersedes'):release.guard(self.sha,10)
 def test_failed_newer_deployment_does_not_block_valid_recovery(self):
  failed=[{'name':'deploy','conclusion':'failure'}]
  with patch.object(release,'request',side_effect=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(11),self.candidate(10)]},{'jobs':failed}]):
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
   responses=[{'workflow_run_id':ids[0]},self.child_run(),{'workflow_run_id':ids[1]},self.child_run(conclusion)]
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
  responses=[{'workflow_run_id':20},self.child_run(sha='b'*40)]
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
   with self.assertRaisesRegex(ValueError,'does not match'):release.synchronize(self.sha,10)
   mocks[4].assert_not_called()

 def test_first_origin_failure_prevents_second_dispatch(self):
  from contextlib import ExitStack
  responses=[{'workflow_run_id':20},self.child_run('failure')]
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
   with self.assertRaisesRegex(ValueError,'deployment failed'):release.synchronize(self.sha,10)
   dispatches=[call for call in mocks[3].call_args_list if '/dispatches' in call.args[0]]
   self.assertEqual(len(dispatches),1);mocks[4].assert_not_called()
 def test_first_origin_is_verified_before_second_dispatch(self):
  from contextlib import ExitStack
  events=[]
  responses=iter([{'workflow_run_id':20},self.child_run(),{'workflow_run_id':21},self.child_run()])
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([])]
   def request(url,*args,**kwargs):
    if '/dispatches' in url:events.append('dispatch')
    return next(responses)
   mocks[3].side_effect=request;mocks[4].side_effect=lambda *args:events.append('verify')
   release.synchronize(self.sha,10)
   self.assertEqual(events[:4],['dispatch','verify','dispatch','verify'])

 def test_queued_dispatch_waits_for_input_based_title_before_verification(self):
  from contextlib import ExitStack
  queued=dict(self.child_run(),status='queued',display_title='Validate and deploy compatibility site')
  responses=[{'workflow_run_id':20},queued,self.child_run(),{'workflow_run_id':21},self.child_run()]
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
   sleep=stack.enter_context(patch.object(release.time,'sleep'))
   release.synchronize(self.sha,10)
   sleep.assert_called_once_with(15);self.assertEqual(mocks[4].call_count,4)

 def test_missing_cancelled_skipped_or_incomplete_gates_reject_release(self):
  for name in ['validate','browser-tests','deploy']:
   for conclusion in [None,'cancelled','skipped','timed_out','failure']:
    with self.subTest(name=name,conclusion=conclusion):
     jobs=copy.deepcopy(self.jobs)
     next(job for job in jobs if job['name']==name)['conclusion']=conclusion
     with self.assertRaises(ValueError):release.checked_run(self.run,jobs,self.sha)
   jobs=[job for job in self.jobs if job['name']!=name]
   with self.assertRaises(ValueError):release.checked_run(self.run,jobs,self.sha)
 def test_out_of_order_listing_cannot_hide_newer_successful_deployment(self):
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(10),self.candidate(9),self.candidate(11)]},{'jobs':self.jobs}]
  with patch.object(release,'request',side_effect=responses):
   with self.assertRaises(release.Superseded):release.guard(self.sha,10)
 def test_older_successful_deployment_does_not_retire_current_release(self):
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(9),self.candidate(10)]}]
  with patch.object(release,'request',side_effect=responses) as request:
   self.assertEqual(release.guard(self.sha,10),self.run)
   self.assertEqual(request.call_count,3)
 def test_missing_source_run_is_an_error_even_if_other_releases_exist(self):
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(9)]}]
  with patch.object(release,'request',side_effect=responses):
   with self.assertRaisesRegex(ValueError,'not found'):release.guard(self.sha,10)
 def test_superseded_between_origins_stops_second_dispatch_and_final_claim(self):
  from contextlib import ExitStack
  responses=[{'workflow_run_id':20},self.child_run()]
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture(responses)]
   def guard(*args):
    if mocks[4].call_count:raise release.Superseded('newer deployment')
   mocks[0].side_effect=guard
   output=io.StringIO()
   with redirect_stdout(output):self.assertFalse(release.synchronize_latest(self.sha,10))
   self.assertEqual(mocks[4].call_count,1)
   self.assertEqual(len([call for call in mocks[3].call_args_list if '/dispatches' in call.args[0]]),1)
   self.assertIn('retired',output.getvalue())
   self.assertNotIn('All compatibility assets verified',output.getvalue())
 def test_superseded_while_polling_queued_child_stops_without_verification(self):
  from contextlib import ExitStack
  queued=dict(self.child_run(),status='queued')
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([{'workflow_run_id':20},queued])]
   sleep=stack.enter_context(patch.object(release.time,'sleep'))
   def guard(*args):
    if sleep.called:raise release.Superseded('newer deployment')
   mocks[0].side_effect=guard
   with redirect_stdout(io.StringIO()):self.assertFalse(release.synchronize_latest(self.sha,10))
   mocks[4].assert_not_called()
   self.assertEqual(mocks[3].call_count,2)
 def test_superseded_after_child_completion_prevents_copy_verification(self):
  from contextlib import ExitStack
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([{'workflow_run_id':20},self.child_run()])]
   def guard(*args):
    if mocks[3].call_count==2:raise release.Superseded('newer deployment')
   mocks[0].side_effect=guard
   with redirect_stdout(io.StringIO()):self.assertFalse(release.synchronize_latest(self.sha,10))
   mocks[4].assert_not_called()
 def test_superseded_during_final_verification_cannot_claim_complete_copies(self):
  from contextlib import ExitStack
  with ExitStack() as stack:
   mocks=[stack.enter_context(p) for p in self.synchronize_fixture([],{'digest':'checked'})]
   def guard(*args):
    if mocks[4].call_count>=2:raise release.Superseded('newer deployment')
   mocks[0].side_effect=guard
   output=io.StringIO()
   with redirect_stdout(output):self.assertFalse(release.synchronize_latest(self.sha,10))
   self.assertEqual(mocks[4].call_count,2)
   self.assertNotIn('All compatibility assets verified',output.getvalue())
 def test_failed_child_can_only_retire_after_confirmed_supersession(self):
  from contextlib import ExitStack
  for conclusion in ['failure','cancelled']:
   with self.subTest(conclusion=conclusion),ExitStack() as stack:
    mocks=[stack.enter_context(p) for p in self.synchronize_fixture([{'workflow_run_id':20},self.child_run(conclusion)])]
    def guard(*args):
     if mocks[3].call_count==2:raise release.Superseded('newer deployment')
    mocks[0].side_effect=guard
    output=io.StringIO()
    with redirect_stdout(output):self.assertFalse(release.synchronize_latest(self.sha,10))
    mocks[4].assert_not_called()
    self.assertIn('No complete-copy verification claimed',output.getvalue())
 def test_current_failed_or_cancelled_child_remains_a_failed_release(self):
  from contextlib import ExitStack
  for conclusion in ['failure','cancelled']:
   with self.subTest(conclusion=conclusion),ExitStack() as stack:
    mocks=[stack.enter_context(p) for p in self.synchronize_fixture([{'workflow_run_id':20},self.child_run(conclusion)])]
    with self.assertRaisesRegex(ValueError,'deployment failed'):release.synchronize_latest(self.sha,10)
    mocks[4].assert_not_called()
 def test_genuine_failure_propagates_unchanged_when_source_still_current(self):
  error=ValueError('Compatibility deployment failed')
  with patch.object(release,'synchronize',side_effect=error),patch.object(release,'guard',return_value=self.run):
   with self.assertRaises(ValueError) as raised:release.synchronize_latest(self.sha,10)
   self.assertIs(raised.exception,error)
 def test_api_uncertainty_never_retires_failed_copy(self):
  error=ValueError('Compatibility deployment failed')
  api_error=RuntimeError('API unavailable')
  with patch.object(release,'synchronize',side_effect=error),patch.object(release,'guard',side_effect=api_error):
   with self.assertRaises(RuntimeError) as raised:release.synchronize_latest(self.sha,10)
   self.assertIs(raised.exception,api_error)
 def test_retired_release_summary_never_claims_all_copies_verified(self):
  with tempfile.TemporaryDirectory() as tmp:
   summary=Path(tmp)/'summary.md'
   with patch.dict(os.environ,{'GITHUB_STEP_SUMMARY':str(summary)}),patch.object(release,'synchronize',side_effect=release.Superseded('newer deployment')):
    with redirect_stdout(io.StringIO()):self.assertFalse(release.synchronize_latest(self.sha,10))
   text=summary.read_text()
   self.assertIn('retired',text)
   self.assertIn('No complete-copy verification claimed',text)
   self.assertNotIn('All compatibility copies verified',text)
 def test_completed_current_release_reports_verified_summary(self):
  with tempfile.TemporaryDirectory() as tmp:
   summary=Path(tmp)/'summary.md'
   with patch.dict(os.environ,{'GITHUB_STEP_SUMMARY':str(summary)}),patch.object(release,'synchronize'):
    self.assertTrue(release.synchronize_latest(self.sha,10))
   self.assertEqual(summary.read_text(),'All compatibility copies verified for '+self.sha+'\n')

 def test_skipped_or_missing_actual_deployment_step_cannot_authorize_copies(self):
  for steps in [[],[{'name':'Deploy validated artifact','conclusion':'skipped'}],[{'name':'Deploy validated artifact','conclusion':'cancelled'}]]:
   jobs=copy.deepcopy(self.jobs);jobs[-1]['steps']=steps
   with self.assertRaisesRegex(ValueError,'deployment action'):release.checked_run(self.run,jobs,self.sha)
 def test_newer_successful_job_with_skipped_publication_does_not_supersede(self):
  skipped=copy.deepcopy(self.jobs);skipped[-1]['steps'][0]['conclusion']='skipped'
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[self.candidate(11),self.candidate(10)]},{'jobs':skipped}]
  with patch.object(release,'request',side_effect=responses):self.assertEqual(release.guard(self.sha,10),self.run)
 def test_duplicate_canonical_gate_cannot_authorize_copies(self):
  for name in ['validate','browser-tests','deploy']:
   jobs=copy.deepcopy(self.jobs);jobs.append(copy.deepcopy(next(job for job in jobs if job['name']==name)))
   with self.assertRaises(ValueError):release.checked_run(self.run,jobs,self.sha)
 def test_unrelated_newer_workflow_cannot_supersede_canonical_release(self):
  other=self.candidate(11);other['path']='unrelated.yml'
  responses=[self.run,{'jobs':self.jobs},{'workflow_runs':[other,self.candidate(10)]}]
  with patch.object(release,'request',side_effect=responses) as request:
   self.assertEqual(release.guard(self.sha,10),self.run)
   self.assertEqual(request.call_count,3)
