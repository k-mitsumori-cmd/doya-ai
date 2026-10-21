import pathlib, os, subprocess, uuid, json, datetime, shutil
bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in bins if (p/'initdb').is_file() and (p/'pg_ctl').is_file()), None)
if pg is None: raise SystemExit('Isolated PostgreSQL binaries unavailable')
folder = pathlib.Path('/tmp') / ('doya-shodan-closure-' + uuid.uuid4().hex[:8]); folder.mkdir(mode=0o700); (folder/'socket').mkdir(mode=0o700)
env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}; port = 56599; started = False
report = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'Owned ephemeral Unix socket PostgreSQL, synthetic data only; no production connection', 'privateRoot': str(folder)}
try:
 with (folder/'init.log').open('w') as log: subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','doya_shodan_closure','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k " + str(folder/'socket') + " -h '' -p " + str(port) + " -F -c timezone=UTC",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True); started = True
 child = {**env,'DOYA_SHODAN_CLOSURE_PG_SOCKET': str(folder/'socket'),'DOYA_SHODAN_CLOSURE_PG_PORT': str(port),'DOYA_SHODAN_CLOSURE_PG_ROOT': str(folder)}
 result = subprocess.run(['node','scripts/security-regression/verify-shodan-closure-postgres.cjs'],env=child,timeout=180)
 report['testExitCode'] = result.returncode
finally:
 if started:
  stop = subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL); report['stopExitCode'] = stop.returncode
 report['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
 if report.get('stopExitCode') == 0: shutil.rmtree(folder)
 report['removedOwnedDirectory'] = not folder.exists(); print(json.dumps(report))
if report.get('testExitCode') != 0 or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory']: raise SystemExit(1)
