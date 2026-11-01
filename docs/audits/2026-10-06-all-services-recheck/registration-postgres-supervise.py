import pathlib,os,subprocess,uuid,json,datetime
pg=pathlib.Path('/opt/homebrew/opt/postgresql@17/bin');folder=pathlib.Path('/tmp')/('doya-reg-'+uuid.uuid4().hex[:8]);folder.mkdir();(folder/'socket').mkdir();port=56391;env={k:v for k,v in os.environ.items() if not k.startswith('PG')};report=pathlib.Path('docs/audits/2026-10-06-all-services-recheck/registration-postgres-supervisor.json');state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'privateFolder':str(folder),'status':'running'};report.write_text(json.dumps(state,indent=2)+'\n');started=False
try:
 with (folder/'init.log').open('w') as out: subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','doya_fixture','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k "+str(folder/'socket')+" -h '' -p "+str(port)+" -F",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True);started=True
 childEnv={**env,'DOYA_REGISTRATION_PG_SOCKET':str(folder/'socket'),'DOYA_REGISTRATION_PG_PORT':str(port)}
 with pathlib.Path('docs/audits/2026-10-06-all-services-recheck/registration-postgres.log').open('w') as out: result=subprocess.run(['node','docs/audits/2026-10-06-all-services-recheck/registration-postgres-probe.cjs'],env=childEnv,stdout=out,stderr=subprocess.STDOUT)
 state['probeExitCode']=result.returncode;state['status']='passed' if result.returncode==0 else 'failed'
finally:
 if started:
  stop=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL);state['stopExitCode']=stop.returncode
 state['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state))
