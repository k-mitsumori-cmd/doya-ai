import datetime, hashlib, json, os, pathlib, shutil, subprocess, tempfile, uuid

bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in bins if (p/'initdb').is_file() and (p/'pg_ctl').is_file()), None)
if pg is None: raise SystemExit('Private PostgreSQL binaries unavailable')
repo = pathlib.Path(__file__).resolve().parents[2]
root = pathlib.Path(tempfile.mkdtemp(prefix='doya-income-r1-', dir='/tmp')); root.chmod(0o700); (root/'socket').mkdir(mode=0o700)
run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:6]
evidence = pathlib.Path(os.environ.get('DOYA_INCOME_R1_EVIDENCE_DIR', str(pathlib.Path(tempfile.gettempdir())/'doya-income-domain-evidence'))).resolve(); evidence.mkdir(parents=True, exist_ok=True)
env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}; port = 56421; started = False
report = {'runId':run_id,'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'privateRoot': str(root), 'evidenceDirectory': str(evidence), 'scope': 'Owned Unix socket PostgreSQL, synthetic fixture and actual Income source only'}
try:
 with (root/'init.log').open('w') as log: subprocess.run([str(pg/'initdb'),'-D',str(root/'data'),'-U','doya_income_r1','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(root/'data'),'-o',"-k " + str(root/'socket') + " -h '' -p " + str(port) + " -F -c timezone=UTC",'-l',str(root/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True); started=True
 child = {**env, 'DOYA_INCOME_R1_SOCKET': str(root/'socket'), 'DOYA_INCOME_R1_PORT':str(port),'DOYA_INCOME_R1_ROOT':str(root),'DOYA_INCOME_R1_RUN_ID':run_id,'DOYA_INCOME_R1_EVIDENCE_DIR':str(evidence)}
 child['DATABASE_URL'] = f"postgresql://doya_income_r1@localhost:{port}/postgres?host={root/'socket'}&schema=income_fixture"
 report['testLog']=str(evidence/('postgres-test-'+run_id+'.log'))
 with pathlib.Path(report['testLog']).open('w') as log:
  try:
   result = subprocess.run(['node',str(pathlib.Path(__file__).with_suffix('.cjs'))],cwd=repo,env=child,stdout=log,stderr=subprocess.STDOUT,timeout=300)
   report['testExitCode']=result.returncode
  except subprocess.TimeoutExpired:
   report['testExitCode']=124
   log.write('Income private PostgreSQL probe timed out after 300 seconds\n')
 report['testLogSha256']=hashlib.sha256(pathlib.Path(report['testLog']).read_bytes()).hexdigest()
 result_file=evidence/('postgres-results-'+run_id+'.json')
 if result_file.exists(): report['resultFile']=str(result_file); report['resultSha256']=hashlib.sha256(result_file.read_bytes()).hexdigest()
except Exception as error:
 report['error']=f'{type(error).__name__}: {error}'
finally:
 if started:
  stop=subprocess.run([str(pg/'pg_ctl'),'-D',str(root/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL); report['stopExitCode']=stop.returncode
 for name in ('init.log','server.log'):
  source=root/name
  if source.exists():
   target=evidence/(name+'-'+run_id+'.log'); shutil.copyfile(source,target); report[name+'Sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
 report['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 if not started or report.get('stopExitCode') == 0: shutil.rmtree(root)
 report['removedOwnedDirectory']=not root.exists()
 (evidence/('postgres-run-'+run_id+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report))
if report.get('testExitCode') != 0 or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory']: raise SystemExit(1)
