import pathlib,os,subprocess,uuid,json,datetime,hashlib
candidates=[pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),*sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),key=lambda p:int(p.parent.name),reverse=True)]
pg=next((p for p in candidates if (p/'initdb').is_file() and (p/'pg_ctl').is_file()),None)
if pg is None:raise SystemExit('PostgreSQL initdb/pg_ctl not installed; private operation regression cannot run')
folder=pathlib.Path('/tmp')/('doya-sfa-authority-'+uuid.uuid4().hex[:8]);folder.mkdir(mode=0o700);(folder/'socket').mkdir(mode=0o700);port=56481;env={k:v for k,v in os.environ.items() if not k.startswith('PG')};base=pathlib.Path('docs/audits/2026-10-06-all-services-recheck');report=base/'membership-known-role-integrated-postgres-supervisor.json';state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'privateFolder':str(folder),'status':'running'};report.write_text(json.dumps(state,indent=2)+'\n');started=False
try:
 with (folder/'init.log').open('w') as out:subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','doya_sfa','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k "+str(folder/'socket')+" -h '' -p "+str(port)+" -F -c timezone=UTC",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True);started=True
 childEnv={**env,'DOYA_SFA_AUTHORITY_PG_SOCKET':str(folder/'socket'),'DOYA_SFA_AUTHORITY_PG_PORT':str(port)}
 with (base/'membership-known-role-integrated-postgres.log').open('w') as out:result=subprocess.run(['node',str(base/'verify-membership-known-role-integrated-postgres.cjs')],env=childEnv,stdout=out,stderr=subprocess.STDOUT,timeout=180)
 evidence=base/'membership-known-role-integrated-postgres-results.json'
 proof=json.loads(evidence.read_text()) if evidence.exists() else {}
 evidenceValid=proof.get('passed')==81 and len(proof.get('cases',[]))==81 and proof.get('checkedAt','')>=state['startedAt'] and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in proof.get('sourceHashes',{}).items()) and len(proof.get('sourceHashes',{}))>=17
 state.update(probeExitCode=result.returncode,evidenceValid=evidenceValid,status='passed' if result.returncode==0 and evidenceValid else 'failed')
finally:
 if started:
  stop=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL);state['stopExitCode']=stop.returncode
  status=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'status'],env=env,stdout=subprocess.DEVNULL);state['postStopStatusExitCode']=status.returncode
  if stop.returncode==0 and status.returncode==3:
   import shutil
   shutil.rmtree(folder);state['privateFolderRemoved']=not folder.exists()
 state['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state))
if state['status']!='passed':raise SystemExit(1)
