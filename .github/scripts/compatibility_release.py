"""Build, dispatch and verify exact-revision legacy bundles. No source-write credential."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from build_old_site_redirect import build
from check_site import stage_site

REPOSITORY='ystoneman/savekewriversideprimaryschool-site'
TARGETS={'ystoneman/kew-riverside-website':'https://ystoneman.github.io/kew-riverside-website/', 'ystoneman/savekewriverside-site':'https://savekewriverside.org/'}
RECORD='compatibility-release.json'

class Superseded(ValueError):
 pass


def require(ok,message):
 if not ok:raise ValueError(message)
def digest(files):
 return hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def files_in(folder):
 folder=Path(folder)
 require(not any(p.is_symlink() for p in folder.rglob('*')),'Bundle contains a symlink.')
 return {p.relative_to(folder).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file() and p.name!=RECORD}
def request(url,method='GET',data=None,authenticated=False):
 headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Kew-compatibility-release','Cache-Control':'no-cache'}
 if authenticated:
  token=os.environ.get('GH_TOKEN');require(bool(token),'Missing scoped GitHub App token.')
  headers['Authorization']='Bearer '+token
 payload=json.dumps(data).encode() if data is not None else None
 with urllib.request.urlopen(urllib.request.Request(url,data=payload,headers=headers,method=method),timeout=30) as response:
  raw=response.read();return json.loads(raw) if raw else None

def actually_deployed(jobs):
 matches=[job for job in jobs if job.get('name')=='deploy']
 if len(matches)!=1 or matches[0].get('conclusion')!='success':return False
 steps=[step for step in matches[0].get('steps',[]) if step.get('name')=='Deploy validated artifact']
 return len(steps)==1 and steps[0].get('conclusion')=='success'

def checked_run(run,jobs,sha):
 require(re.fullmatch(r'[0-9a-f]{40}',sha) is not None,'Invalid source SHA.')
 require(run.get('head_sha')==sha and run.get('head_branch')=='main' and run.get('event')=='push' and run.get('path')=='.github/workflows/pages.yml','Source must be a canonical main release.')
 for name in ['validate','browser-tests','deploy']:
  matches=[job for job in jobs if job.get('name')==name]
  require(len(matches)==1 and matches[0].get('conclusion')=='success','Canonical validation, browser tests and deployment must have succeeded.')
 require(actually_deployed(jobs),'Canonical deployment action must have succeeded.')

def guard(sha,run_id):
 require(str(run_id).isdigit(),'Invalid source run identifier.')
 base='https://api.github.com/repos/'+REPOSITORY
 run=request(base+'/actions/runs/'+str(run_id))
 jobs=[];page=1
 while True:
  batch=request(base+'/actions/runs/'+str(run_id)+'/jobs?per_page=100&page='+str(page))['jobs'];jobs+=batch
  if len(batch)<100:break
  page+=1
 checked_run(run,jobs,sha)
 # Only actual canonical publications supersede; skipped stale jobs do not.
 releases=request(base+'/actions/runs?branch=main&event=push&per_page=30')['workflow_runs']
 require(any(candidate['id']==int(run_id) for candidate in releases),'Source release not found among recent canonical releases.')
 for candidate in releases:
  if candidate['id']<=int(run_id):continue
  if candidate.get('path')!='.github/workflows/pages.yml' or candidate.get('event')!='push' or candidate.get('head_branch')!='main':continue
  candidate_jobs=request(base+'/actions/runs/'+str(candidate['id'])+'/jobs?per_page=100')['jobs']
  if actually_deployed(candidate_jobs):
   raise Superseded('A newer canonical deployment supersedes this release.')
 return run

def prepare(output,sha,run_id):
 guard(sha,run_id)
 actual=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 require(actual==sha,'Checked-out source differs from the release.')
 with tempfile.TemporaryDirectory() as temporary:
  staged=Path(temporary)/'source';stage_site(staged);build(staged,output)
 files=files_in(output)
 record={'version':1,'source_repository':REPOSITORY,'source_sha':sha,'source_run':int(run_id),'digest':digest(files),'files':files}
 (Path(output)/RECORD).write_text(json.dumps(record,sort_keys=True,indent=2)+'\n')
 return record

def remote_record(origin):
 try:return request(origin+RECORD+'?check='+str(time.time_ns()))
 except urllib.error.HTTPError as error:
  if error.code==404:return None
  raise

def verify(origin,record):
 remote=remote_record(origin)
 require(remote is not None and remote.get('digest')==record['digest'],'Compatibility manifest is missing or different: '+origin)
 require(remote.get('files')==record['files'],'Compatibility file set differs: '+origin)
 for name,expected in record['files'].items():
  with urllib.request.urlopen(origin+name+'?check='+str(time.time_ns()),timeout=30) as response:
   require(response.status==200 and response.url.startswith(origin+name+'?'),'Compatibility asset does not remain on its origin: '+name)
   actual=hashlib.sha256(response.read()).hexdigest()
   content_type=response.headers.get_content_type()
  require(actual==expected,'Compatibility bytes differ: '+origin+name)
  ext=Path(name).suffix
  types={'.json':{'application/json'},'.pdf':{'application/pdf'},'.csv':{'text/csv'},'.md':{'text/markdown'},'.html':{'text/html'},'.js':{'application/javascript','text/javascript'},'.css':{'text/css'},'.png':{'image/png'},'.svg':{'image/svg+xml'},'.ics':{'text/calendar'}}
  if ext in types:require(content_type in types[ext],'Unexpected MIME: '+name+' '+content_type)
 return True

def synchronize(sha,run_id):
 guard(sha,run_id)
 with tempfile.TemporaryDirectory() as temporary:
  record=prepare(Path(temporary)/'bundle',sha,run_id)
 deadline=time.monotonic()+1500
 for repository,origin in TARGETS.items():
  guard(sha,run_id)
  current=remote_record(origin)
  if current and current.get('digest')==record['digest']:
   verify(origin,record);print('Already current:',repository,flush=True);continue
  base='https://api.github.com/repos/'+repository
  result=request(base+'/actions/workflows/pages.yml/dispatches','POST',{'ref':'main','inputs':{'source_sha':sha,'source_run':str(run_id)}},True)
  require(isinstance(result,dict) and isinstance(result.get('workflow_run_id'),int),'Dispatch did not return an exact workflow run ID; completion remains unverified.')
  child=result['workflow_run_id'];completed=False
  # Replace and verify one origin before starting the next; keep failures retryable.
  while time.monotonic()<deadline:
   guard(sha,run_id)
   run=request(base+'/actions/runs/'+str(child),authenticated=True)
   # GitHub can return the queued run before its input-based metadata is initialized.
   # The exact dispatch ID stays authoritative; require provenance before completion.
   if run['status']=='completed':
    require(run.get('display_title')=='Compatibility '+sha and run.get('event')=='workflow_dispatch' and run.get('head_branch')=='main' and run.get('path')=='.github/workflows/pages.yml','Dispatched workflow does not match this compatibility release.')
    require(run['conclusion']=='success','Compatibility deployment failed: '+repository+'; rerun the canonical compatibility job after correcting it.')
    guard(sha,run_id)
    verify(origin,record);print('Verified:',repository,flush=True);completed=True;break
   time.sleep(15)
  require(completed,'Compatibility deployment timed out; completion remains unverified.')
 # Read every retained copy once more, including removals, after both deployments.
 for origin in TARGETS.values():
  guard(sha,run_id)
  verify(origin,record)
 guard(sha,run_id)
 print('All compatibility assets verified for',sha,flush=True)

def synchronize_latest(sha,run_id):
 try:
  synchronize(sha,run_id)
 except Exception as error:
  if not isinstance(error,Superseded):
   # A child can fail its own stale guard while the parent is polling it.
   # Only confirmed supersession may retire such a failure; API uncertainty fails.
   try:guard(sha,run_id)
   except Superseded:pass
   else:raise
  message='Superseded compatibility release retired; newer canonical release owns reconciliation. No complete-copy verification claimed.'
  print(message,flush=True)
  if os.environ.get('GITHUB_STEP_SUMMARY'):
   with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as output:output.write(message+'\n')
  return False
 if os.environ.get('GITHUB_STEP_SUMMARY'):
  with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as output:output.write('All compatibility copies verified for '+sha+'\n')
 return True

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('operation',choices=['guard','prepare','synchronize','verify'])
 parser.add_argument('--sha',required=True);parser.add_argument('--run-id',required=True);parser.add_argument('--output');parser.add_argument('--origin',choices=list(TARGETS.values()))
 args=parser.parse_args()
 if args.operation=='guard':guard(args.sha,args.run_id)
 elif args.operation=='prepare':prepare(args.output,args.sha,args.run_id)
 elif args.operation=='synchronize':synchronize_latest(args.sha,args.run_id)
 else:
  with tempfile.TemporaryDirectory() as tmp:
   record=prepare(Path(tmp)/'bundle',args.sha,args.run_id);verify(args.origin,record)
