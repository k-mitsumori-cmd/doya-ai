import pathlib,json,hashlib,subprocess,shutil,datetime,sys,re,os
proof=pathlib.Path(sys.argv[1]);report=pathlib.Path(sys.argv[2]);d=json.loads(proof.read_text());assert d['status']=='passed';app=pathlib.Path(d['app']);assert re.fullmatch(r'/tmp/doya-hr-evaluation-build-[a-f0-9]{8}/app',str(app));assert app.is_dir();assert not app.is_symlink()
try:os.kill(d['pid'],0)
except ProcessLookupError:pass
else:raise AssertionError('Build supervisor still exists; cannot retire cache')
processes=subprocess.check_output(['ps','-axo','pid=,command='],text=True);active=[line.split()[0] for line in processes.splitlines() if str(app) in line];assert not active,active
cwd_result=subprocess.run(['lsof','-a','-d','cwd','-Fpn'],capture_output=True,text=True);assert cwd_result.returncode in (0,1);cwd_active=[];pid=None
for line in cwd_result.stdout.splitlines():
 if line.startswith('p'):pid=line[1:]
 elif line.startswith('n') and (line[1:]==str(app) or line[1:].startswith(str(app)+'/')):cwd_active.append(pid)
assert not cwd_active,cwd_active
cache=app/'.next/cache';assert cache.is_dir() and not cache.is_symlink();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();files=[p for p in app.rglob('*') if p.is_file() and not p.is_relative_to(cache) and not any((app/parent).is_symlink() and p.is_relative_to(app/parent) for parent in ['node_modules','public','assets'])];before={str(p):sha(p) for p in files};free=shutil.disk_usage('/tmp').free;size=sum(p.stat().st_size for p in cache.rglob('*') if p.is_file());shutil.rmtree(cache);after={str(p):sha(p) for p in files};assert before==after
r={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':str(cache),'inactiveBuildProof':str(proof),'activePids':active,'activeCwdPids':cwd_active,'cacheBytes':size,'preservedNonCacheFiles':len(files),'preservedHashesUnchanged':before==after,'freeBefore':free,'freeAfter':shutil.disk_usage('/tmp').free,'scope':'Only inactive task-owned disposable Next cache removed; compiled artifact/source/proof and active builds retained.'};report.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
