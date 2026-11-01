import pathlib,os,subprocess,uuid,json,datetime,shutil,socket,hashlib,signal
if shutil.disk_usage('/tmp').free < 3 * 1024**3:raise SystemExit('Insufficient free disk for isolated full-schema/native verification; retain source evidence and retire only inactive task-owned artifacts')
root=pathlib.Path.cwd();base=root/'docs/audits/2026-10-06-all-services-recheck';build=json.loads((base/'hr-evaluation-candidate-build.json').read_text());assert build['status']=='passed' and build['buildIdExists'] and build['sourcesUnchanged']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=build['sourceHashes'];assert all(pathlib.Path(p).is_file() and sha(pathlib.Path(p))==h for p,h in manifest.items())
app=pathlib.Path(build['app']);assert app.is_relative_to('/tmp') and app.name=='app';assert app.is_dir() and (app/'.next/BUILD_ID').is_file(), 'Compiled app missing: fresh build required before database startup';assert not list(app.glob('.env*'))
pg=pathlib.Path('/opt/homebrew/opt/postgresql@17/bin');folder=pathlib.Path('/tmp')/('doya-sfa-authority-'+uuid.uuid4().hex[:8]);folder.mkdir(mode=0o700);(folder/'socket').mkdir(mode=0o700);(folder/'provider').mkdir(mode=0o700)
with socket.socket() as probe:probe.bind(('127.0.0.1',0));httpPort=probe.getsockname()[1]
port=56481;url='postgresql://doya_sfa@localhost:'+str(port)+'/postgres?host='+str(folder/'socket')+'&sslmode=disable&pgbouncer=false&connection_limit=5';origin='http://127.0.0.1:'+str(httpPort)
guard=folder/'network-guard.cjs';guard.write_text("""const fs=require('node:fs');const allowed=host=>['127.0.0.1','localhost','[::1]','::1'].includes(host);const deny=value=>{fs.appendFileSync(process.env.DOYA_E2E_NETWORK_LOG,JSON.stringify({blocked:String(value)})+'\\n');throw Error('External networking disabled in isolated regression')};const original=global.fetch;global.fetch=(input,...rest)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!allowed(u.hostname)){try{deny(u.origin)}catch(e){return Promise.reject(e)}}return original(input,...rest)};for(const name of ['node:http','node:https']){const http=require(name),request=http.request;http.request=function(...args){const input=args[0],host=typeof input==='string'||input instanceof URL?new URL(input).hostname:input?.hostname||input?.host||'localhost';if(!allowed(host))deny(host);return request.apply(this,args)}}""")
env={'PATH':os.environ['PATH'],'LANG':'en_US.UTF-8','NODE_ENV':'production','DATABASE_URL':url,'DIRECT_URL':url,'NEXTAUTH_URL':origin,'NEXTAUTH_SECRET':'synthetic-local-secret-'+uuid.uuid4().hex,'NEXT_TELEMETRY_DISABLED':'1','DOYA_E2E_ORIGIN':origin,'DOYA_E2E_NETWORK_LOG':str(folder/'blocked-network.log'),'DOYA_E2E_APP':str(app),'DOYA_HR_AI_TEST_DIRECTORY':str(folder/'provider'),'NODE_OPTIONS':'--require '+str(guard)}
state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'privateFolder':str(folder),'appFolder':str(app),'origin':origin,'status':'running','scope':'Actual full Next build/server/auth with full isolated PostgreSQL. Test-only synthetic Gemini provider, no credentials or external provider calls. Server process SIGKILL/restart and durable receipt recovery. Native browser and full-service release gates remain pending.'};report=base/'hr-evaluation-native-next-supervisor.json';report.write_text(json.dumps(state,indent=2)+'\n');started=False
try:
 with (folder/'init.log').open('w') as out:subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','doya_sfa','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k "+str(folder/'socket')+" -h '' -p "+str(port)+" -F -c timezone=UTC",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True);started=True
 schema=folder/'schema.prisma';shutil.copy2(root/'prisma/schema.prisma',schema)
 with (folder/'schema.log').open('w') as out:subprocess.run(['node',str(root/'node_modules/prisma/build/index.js'),'db','push','--skip-generate','--schema',str(schema)],cwd=folder,env=env,stdout=out,stderr=subprocess.STDOUT,check=True,timeout=120)
 with (base/'hr-evaluation-native-next.log').open('w') as out:child=subprocess.run(['node',str(base/'verify-hr-evaluation-native-next.cjs')],cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=360)
 p=base/'hr-evaluation-native-next-results.json';proof=json.loads(p.read_text()) if p.exists() else {};valid=proof.get('original100RetainedExactlyInOrder') is True and proof.get('original86RetainedExactlyInOrder') is True and proof.get('original104RetainedExactlyInOrder') is True and proof.get('expected')==106 and proof.get('passed')==106 and len(proof.get('cases',[]))==106 and proof.get('checkedAt','')>=state['startedAt'] and len(proof.get('sourceHashes',{}))==len(manifest)+6 and all(pathlib.Path(p).is_file() and sha(pathlib.Path(p))==h for p,h in proof.get('sourceHashes',{}).items());state.update(probeExitCode=child.returncode,evidenceValid=valid,status='passed' if child.returncode==0 and valid else 'failed')
except BaseException as error:
 state.update(status='failed',exceptionType=type(error).__name__)
 raise
finally:
 pidfile=folder/'next-pids.json'
 if pidfile.exists():
  for pid in json.loads(pidfile.read_text()):
   if not isinstance(pid,int) or isinstance(pid,bool) or pid<=0:continue
   try:os.killpg(pid,signal.SIGKILL)
   except ProcessLookupError:pass
 if started:
  state['stopExitCode']=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL).returncode
  state['postStopStatusExitCode']=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'status'],env=env,stdout=subprocess.DEVNULL).returncode
 for name in ['next-server.log','schema.log','blocked-network.log']:
  if (folder/name).exists():shutil.copy2(folder/name,base/('hr-evaluation-native-next-'+name))
 if state.get('stopExitCode')==0 and state.get('postStopStatusExitCode')==3:shutil.rmtree(folder);state['privateFolderRemoved']=not folder.exists()
 state['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state))
if state['status']!='passed':raise SystemExit(1)
