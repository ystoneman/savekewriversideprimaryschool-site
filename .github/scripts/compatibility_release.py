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

def require(ok,message):
 if not ok:raise ValueError(message)
def digest(files):
 return hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def files_in(folder):
 folder=Path(folder)
 require(not any(p.is_symlink() for p in folder.rglob('*')),'Bundle contains a symlink.')
 return {p.relative_to(folder).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob('*')) if p.is_file() and p.name!=RECORD}
def request(url,method='GET',data=None,authenticated=False):
 headers={'Accept':'application/vnd.github+json','User-Agent':'Kew-compatibility-release','Cache-Control':'no-cache'}
 if authenticated:
  token=os.environ.get('GH_TOKEN');require(bool(token),'Missing scoped GitHub App token.')
  headers['Authorization']='Bearer '+token
 payload=json.dumps(data).encode() if data is not None else None
 with urllib.request.urlopen(urllib.request.Request(url,data=payload,headers=headers,method=method),timeout=30) as response:
  raw=response.read();return json.loads(raw) if raw else None

def checked_run(run,jobs,sha):
 require(re.fullmatch(r'[0-9a-f]{40}',sha) is not None,'Invalid source SHA.')
 require(run.get('head_sha')==sha and run.get('head_branch')=='main' and run.get('event')=='push' and run.get('path')=='.github/workflows/pages.yml','Source must be a canonical main release.')
 named={j['name']:j.get('conclusion') for j in jobs}
 require(all(named.get(n)=='success' for n in ['validate','browser-tests','deploy']),'Canonical validation, browser tests and deployment must have succeeded.')

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
 # A failed compatibility job does not make the already-successful canonical deploy untrusted.
 releases=request(base+'/actions/runs?branch=main&event=push&per_page=30')['workflow_runs']
 for candidate in releases:
  if candidate['id']==int(run_id):break
  candidate_jobs=request(base+'/actions/runs/'+str(candidate['id'])+'/jobs?per_page=100')['jobs']
  if any(j['name']=='deploy' and j.get('conclusion')=='success' for j in candidate_jobs):
   raise ValueError('A newer canonical deployment supersedes this release.')
 else:raise ValueError('Source release not found among recent canonical releases.')
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
  types={'.json':{'application/json'},'.pdf':{'application/pdf'},'.csv':{'text/csv','application/octet-stream','text/plain'},'.html':{'text/html'},'.js':{'application/javascript','text/javascript'},'.css':{'text/css'},'.png':{'image/png'},'.svg':{'image/svg+xml'},'.ics':{'text/calendar'}}
  if ext in types:require(content_type in types[ext],'Unexpected MIME: '+name+' '+content_type)
 return True

def synchronize(sha,run_id):
 guard(sha,run_id)
 with tempfile.TemporaryDirectory() as temporary:
  record=prepare(Path(temporary)/'bundle',sha,run_id)
 pending=[]
 for repository,origin in TARGETS.items():
  current=remote_record(origin)
  if current and current.get('digest')==record['digest']:
   verify(origin,record);print('Already current:',repository,flush=True);continue
  base='https://api.github.com/repos/'+repository
  result=request(base+'/actions/workflows/pages.yml/dispatches','POST',{'ref':'main','inputs':{'source_sha':sha,'source_run':str(run_id)}},True)
  pending.append((base,repository,origin,result.get('workflow_run_id') if result else None))
 deadline=time.monotonic()+1500
 while pending and time.monotonic()<deadline:
  remaining=[]
  for base,repository,origin,child in pending:
   if child:
    run=request(base+'/actions/runs/'+str(child),authenticated=True)
   else:
    runs=request(base+'/actions/runs?event=workflow_dispatch&per_page=30',authenticated=True)['workflow_runs']
    run=next((r for r in runs if r.get('display_title')=='Compatibility '+sha),None)
   if run and run['status']=='completed':
    require(run['conclusion']=='success','Compatibility deployment failed: '+repository+'; rerun the canonical compatibility job after correcting it.')
    verify(origin,record);print('Verified:',repository,flush=True)
   else:remaining.append((base,repository,origin,child))
  pending=remaining
  if pending:time.sleep(15)
 require(not pending,'Compatibility deployment timed out; completion remains unverified.')
 # Read every retained copy once more, including removals, after both deployments.
 for origin in TARGETS.values():verify(origin,record)
 print('All compatibility assets verified for',sha,flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('operation',choices=['guard','prepare','synchronize','verify'])
 parser.add_argument('--sha',required=True);parser.add_argument('--run-id',required=True);parser.add_argument('--output');parser.add_argument('--origin',choices=list(TARGETS.values()))
 args=parser.parse_args()
 if args.operation=='guard':guard(args.sha,args.run_id)
 elif args.operation=='prepare':prepare(args.output,args.sha,args.run_id)
 elif args.operation=='synchronize':synchronize(args.sha,args.run_id)
 else:
  with tempfile.TemporaryDirectory() as tmp:
   record=prepare(Path(tmp)/'bundle',args.sha,args.run_id);verify(args.origin,record)
