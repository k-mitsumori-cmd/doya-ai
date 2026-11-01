import pathlib,json,hashlib,subprocess,shutil,datetime,re
root=pathlib.Path.cwd();assert root==pathlib.Path('/Users/mitsumori_katsuki/Code/doya-billing-client-20261006')
base=root/'docs/audits/2026-10-06-all-services-recheck';pointer=base/'hr-evaluation-integrated-current-gate.txt'
if pointer.is_file():
 gate=pathlib.Path(pointer.read_text().strip());assert gate.parent.resolve()==base.resolve() and gate.name.startswith('hr-evaluation-integrated-release-')
 proof=gate/'state.json';state=json.loads(proof.read_text());assert state['status']=='running' and any(x['name']=='build' and x['exitCode']==0 for x in state['gates']) and all(x['exitCode']==0 for x in state['gates'])
 manifest=json.loads((gate/'source-manifest.json').read_text());assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in manifest.items())
else:
 proof=base/'hr-department-read-release-7de2d4d0-8268-4d0f-acc5-5d2a5a60ba9c/state.json';state=json.loads(proof.read_text());assert state['status']=='passed' and len(state['gates'])==192 and all(x['exitCode']==0 for x in state['gates'])
 public=json.loads((base/'hr-department-read-public.json').read_text());assert public['passed'] and public['commit']==subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
 assert subprocess.run(['git','merge-base','--is-ancestor',state['head'],public['commit']]).returncode==0

artifact=root/'.next';cache=artifact/'cache';assert artifact.is_dir() and not artifact.is_symlink() and cache.is_dir() and not cache.is_symlink()
processes=subprocess.check_output(['ps','-axo','pid=,command='],text=True)
# Reject any active Next compiler/runtime; do not infer inactivity from old PIDs.
active=[line for line in processes.splitlines() if re.search(r'(next/dist/bin/next\s+(build|start|dev)|next-server|next dev|next build|next start)',line) and 'rg ' not in line]
assert not active,active
opened=subprocess.run(['lsof','+D',str(artifact)],capture_output=True,text=True);assert opened.returncode==1 and not opened.stdout.strip(),'Next artifacts are open by another process'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();files=[p for p in artifact.rglob('*') if p.is_file() and not p.is_relative_to(cache)];before={str(p):sha(p) for p in files};free=shutil.disk_usage(root).free;size=sum(p.stat().st_size for p in cache.rglob('*') if p.is_file());shutil.rmtree(cache);after={str(p):sha(p) for p in files};assert before==after
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':str(cache),'completedTaskProof':str(proof),'activeNextProcesses':active,'openFiles':False,'cacheBytes':size,'preservedNonCacheFiles':len(files),'preservedHashesUnchanged':before==after,'freeBefore':free,'freeAfter':shutil.disk_usage(root).free,'scope':'Only reproducible webpack cache in this completed task checkout. Compiled artifacts/source/evidence retained unchanged.'};(base/'hr-evaluation-integrated-cache-retirement.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
