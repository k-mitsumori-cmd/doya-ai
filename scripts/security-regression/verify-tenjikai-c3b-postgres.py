"""Run the Tenjikai/lifecycle race only on a uniquely owned private PostgreSQL socket."""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, uuid

repo = pathlib.Path(__file__).resolve().parents[2]
bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in bins if (p/'initdb').is_file() and (p/'pg_ctl').is_file()), None)
if pg is None: raise SystemExit('Private PostgreSQL binaries unavailable')
for _ in range(4):
 root = pathlib.Path('/tmp') / ('doya-tenjikai-c3b-' + uuid.uuid4().hex[:8])
 try: root.mkdir(mode=0o700); break
 except FileExistsError: continue
else: raise SystemExit('Unable to reserve a unique private PostgreSQL directory')
root.chmod(0o700); (root/'socket').mkdir(mode=0o700)
run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:6]
evidence = pathlib.Path(os.environ.get('DOYA_TENJIKAI_C3B_EVIDENCE_DIR', str(repo.parent/'sandbox/doya-tenjikai-c3b-20261021'))).resolve(); evidence.mkdir(parents=True, exist_ok=True)
env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}; port = 56528; started = False
report = {'runId':run_id,'privateRoot':str(root),'scope':'Owned Unix socket PostgreSQL, actual route + lifecycle store, synthetic session and AI only'}
try:
 with (root/'init.log').open('w') as log: subprocess.run([str(pg/'initdb'),'-D',str(root/'data'),'-U','doya_tenjikai_c3b','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(root/'data'),'-o',"-k " + str(root/'socket') + " -h '' -p " + str(port) + " -F -c timezone=UTC",'-l',str(root/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True); started=True
 child = {**env,'DOYA_TENJIKAI_C3B_ROOT':str(root),'DOYA_TENJIKAI_C3B_SOCKET':str(root/'socket'),'DOYA_TENJIKAI_C3B_PORT':str(port),'DOYA_TENJIKAI_C3B_RUN_ID':run_id,'DOYA_TENJIKAI_C3B_EVIDENCE_DIR':str(evidence)}
 child['DATABASE_URL'] = f"postgresql://doya_tenjikai_c3b@localhost:{port}/postgres?host={root/'socket'}&schema=tenjikai_fixture"
 log_file = evidence/('postgres-test-'+run_id+'.log'); report['testLog']=str(log_file)
 with log_file.open('w') as log:
  try: report['testExitCode']=subprocess.run(['node',str(pathlib.Path(__file__).with_suffix('.cjs'))],cwd=repo,env=child,stdout=log,stderr=subprocess.STDOUT,timeout=300).returncode
  except subprocess.TimeoutExpired: report['testExitCode']=124; log.write('Private PostgreSQL probe timed out after 300 seconds\n')
 report['testLogSha256']=hashlib.sha256(log_file.read_bytes()).hexdigest()
 result=evidence/('postgres-results-'+run_id+'.json')
 if result.exists(): report['resultFile']=str(result); report['resultSha256']=hashlib.sha256(result.read_bytes()).hexdigest()
except Exception as error: report['error']=f'{type(error).__name__}: {error}'
finally:
 if started: report['stopExitCode']=subprocess.run([str(pg/'pg_ctl'),'-D',str(root/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL).returncode
 for name in ('init.log','server.log'):
  source=root/name
  if source.exists():
   target=evidence/(name+'-'+run_id+'.log'); shutil.copyfile(source,target); report[name+'Sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
 if not started or report.get('stopExitCode') == 0: shutil.rmtree(root)
 report['removedOwnedDirectory']=not root.exists()
 (evidence/('postgres-run-'+run_id+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report))
if report.get('testExitCode') != 0 or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory']: raise SystemExit(1)
