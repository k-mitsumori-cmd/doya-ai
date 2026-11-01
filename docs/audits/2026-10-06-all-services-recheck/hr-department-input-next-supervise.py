import pathlib,os,subprocess,uuid,json,datetime,shutil,socket,time,urllib.request,hashlib
root=pathlib.Path.cwd();base=root/'docs/audits/2026-10-06-all-services-recheck';gate=pathlib.Path((pathlib.Path(os.environ.get('DOYA_FROZEN_GATE_POINTER',str(base/'hr-department-input-current-gate.txt')))).read_text().strip());stateGate=json.loads((gate/'state.json').read_text());assert stateGate['status'] in ['running','passed'] and len(stateGate['gates'])>=148 and any(x['name']=='build' and x['exitCode']==0 for x in stateGate['gates']),'Run only after the frozen build succeeds'
manifest=json.loads((gate/'source-manifest.json').read_text());assert all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in manifest.items()),'Frozen source changed'
pg=pathlib.Path('/opt/homebrew/opt/postgresql@17/bin');folder=pathlib.Path('/tmp')/('doya-sfa-authority-'+uuid.uuid4().hex[:8]);folder.mkdir(mode=0o700);(folder/'socket').mkdir(mode=0o700);app=folder/'app';app.mkdir();(app/'prisma').mkdir();shutil.copy2(root/'prisma/schema.prisma',app/'prisma/schema.prisma');shutil.copy2(root/'package.json',app/'package.json');(app/'node_modules').symlink_to(root/'node_modules',target_is_directory=True);(app/'public').symlink_to(root/'public',target_is_directory=True)
shutil.copytree(root/'.next',app/'.next',ignore=lambda p,names: {'cache'} if pathlib.Path(p)==root/'.next' else set());assert not any(app.glob('.env*'))
guard=folder/'network-guard.cjs';guard.write_text("""const fs=require('node:fs');const allowed=hostname=>['127.0.0.1','localhost','[::1]','::1'].includes(hostname);const deny=value=>{fs.appendFileSync(process.env.DOYA_E2E_NETWORK_LOG,JSON.stringify({blocked:String(value)})+'\\n');throw Error('External networking disabled in isolated regression')};const original=global.fetch;global.fetch=(input,...rest)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!allowed(u.hostname))return Promise.reject((()=>{try{deny(u.origin)}catch(e){return e}})());return original(input,...rest)};for(const module of ['node:http','node:https']){const http=require(module),originalRequest=http.request;http.request=function(...args){const first=args[0];const host=typeof first==='string'||first instanceof URL?new URL(first).hostname:first?.hostname||first?.host||'localhost';if(!allowed(host))deny(host);return originalRequest.apply(this,args)}}""")
with socket.socket() as probe:probe.bind(('127.0.0.1',0));httpPort=probe.getsockname()[1]
port=56481;url='postgresql://doya_sfa@localhost:'+str(port)+'/postgres?host='+str(folder/'socket')+'&sslmode=disable&pgbouncer=false&connection_limit=3';origin='http://127.0.0.1:'+str(httpPort)
env={'PATH':os.environ['PATH'],'LANG':'en_US.UTF-8','NODE_ENV':'production','DATABASE_URL':url,'DIRECT_URL':url,'NEXTAUTH_URL':origin,'NEXTAUTH_SECRET':'synthetic-local-secret-'+uuid.uuid4().hex,'NEXT_TELEMETRY_DISABLED':'1','DOYA_E2E_ORIGIN':origin,'DOYA_E2E_NETWORK_LOG':str(folder/'blocked-network.log'),'DOYA_E2E_APP':str(app),'NODE_OPTIONS':'--require '+str(guard)}
state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'privateFolder':str(folder),'appFolder':str(app),'origin':origin,'gate':str(gate),'status':'running','scope':'Actual built Next server with actual auth session adapter and isolated full-schema PostgreSQL; synthetic HR/Kintai users, organizations and sessions; cache headers, cross-actor reads and revoked session checks, plus inactive department hierarchy and unassigned employee representation. No provider credentials or production data; outbound network blocked.'};report=base/'hr-department-input-next-supervisor.json';report.write_text(json.dumps(state,indent=2)+'\n');started=False;server=None;log=None
try:
 with (folder/'init.log').open('w') as out:subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','doya_sfa','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k "+str(folder/'socket')+" -h '' -p "+str(port)+" -F -c timezone=UTC",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True);started=True
 with (folder/'schema.log').open('w') as out:subprocess.run(['node',str(root/'node_modules/prisma/build/index.js'),'db','push','--skip-generate','--schema',str(app/'prisma/schema.prisma')],cwd=app,env=env,stdout=out,stderr=subprocess.STDOUT,check=True,timeout=120)
 log=(folder/'next-server.log').open('w');server=subprocess.Popen(['node',str(root/'node_modules/next/dist/bin/next'),'start',str(app),'-H','127.0.0.1','-p',str(httpPort)],cwd=app,env=env,stdout=log,stderr=subprocess.STDOUT)
 for attempt in range(90):
  if server.poll() is not None:raise RuntimeError('Isolated Next server exited')
  try:
   with urllib.request.urlopen(origin+'/api/auth/providers',timeout=2) as response:
    if response.status==200:break
  except Exception:time.sleep(.5)
 else:raise RuntimeError('Isolated Next server not ready')
 with (base/'hr-department-input-next.log').open('w') as out:child=subprocess.run(['node',str(base/'verify-hr-department-input-next.cjs')],cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=300)
 evidence=base/'hr-department-input-next-results.json';proof=json.loads(evidence.read_text()) if evidence.exists() else {};valid=proof.get('expected')==53 and proof.get('passed')==53 and len(proof.get('cases',[]))==53 and proof.get('checkedAt','')>=state['startedAt'] and len(proof.get('sourceHashes',{}))==17 and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in proof.get('sourceHashes',{}).items()) and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in manifest.items());state.update(probeExitCode=child.returncode,evidenceValid=valid,status='passed' if child.returncode==0 and valid else 'failed')
except BaseException as error:
 state.update(status='failed',exceptionType=type(error).__name__)
 raise
finally:
 if server is not None:
  server.terminate()
  try:server.wait(timeout=15)
  except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
  state['serverExitCode']=server.returncode
 if log:log.close()
 if started:state['stopExitCode']=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL).returncode
 if started and state.get('stopExitCode')==0:
  status=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'status'],env=env,stdout=subprocess.DEVNULL);state['postStopStatusExitCode']=status.returncode
 for name in ['next-server.log','schema.log','blocked-network.log']:
  if (folder/name).exists():shutil.copy2(folder/name,base/('hr-department-input-next-'+name))
 if state.get('stopExitCode')==0 and state.get('postStopStatusExitCode')==3:
  shutil.rmtree(folder);state['privateFolderRemoved']=not folder.exists()
 state['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state))
if state['status']!='passed' or state.get('stopExitCode')!=0:raise SystemExit(1)
