import pathlib,os,subprocess,uuid,json,datetime,shutil,hashlib
root=pathlib.Path.cwd();base=root/'docs/audits/2026-10-06-all-services-recheck';overlay=base/'hr-department-operation-repair-overlay';folder=pathlib.Path('/tmp')/('doya-hr-operation-build-'+uuid.uuid4().hex[:8]);app=folder/'app';app.mkdir(parents=True,mode=0o700)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name in ['src','seo','prisma','LOGO/generator']:
 shutil.copytree(root/name,app/name)
for name in ['package.json','next.config.js','tsconfig.json','next-env.d.ts','postcss.config.js','tailwind.config.ts','.eslintrc.json']:
 if (root/name).is_file():shutil.copy2(root/name,app/name)
for name in ['node_modules','public','assets']:
 if (root/name).exists():(app/name).symlink_to(root/name,target_is_directory=True)
for source in overlay.rglob('*'):
 if source.is_file():
  dest=app/source.relative_to(overlay);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
assert not list(app.glob('.env*'))
manifest={str(p):sha(p) for prefix in ['src','seo','prisma','LOGO/generator'] for p in (root/prefix).rglob('*') if p.is_file()}
manifest.update({str(p):sha(p) for p in overlay.rglob('*') if p.is_file()})
guard=folder/'deny-network.cjs';guard.write_text("""const hosts=new Set(['fonts.googleapis.com','fonts.gstatic.com']);const allowed=(input,options={})=>{try{const u=typeof input==='string'||input instanceof URL?new URL(input):{hostname:input.hostname||input.host,protocol:input.protocol||'https:'};return u.protocol==='https:'&&hosts.has(u.hostname)&&(options.method||input.method||'GET').toUpperCase()==='GET'}catch{return false}};const deny=()=>{throw Error('Non-font external networking disabled in candidate build')};const originalFetch=global.fetch;global.fetch=(input,init={})=>allowed(input,init)?originalFetch(input,init):deny();for(const name of ['node:http','node:https']){const h=require(name),request=h.request,get=h.get;h.request=function(...args){if(!allowed(args[0],args[1]||{}))return deny();return request.apply(this,args)};h.get=function(...args){if(!allowed(args[0],args[1]||{}))return deny();return get.apply(this,args)}}const net=require('node:net'),connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const o=args[0];if(o&&typeof o==='object'&&(o.fd!==undefined||hosts.has(o.hostname||o.host)))return connect.apply(this,args);return deny()};""")
env={'PATH':os.environ['PATH'],'LANG':'en_US.UTF-8','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','NEXTAUTH_URL':'http://127.0.0.1:1','NEXTAUTH_SECRET':'synthetic-local-candidate-build','DATABASE_URL':'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic','DIRECT_URL':'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic','NODE_OPTIONS':'--require '+str(guard)}
state={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':os.getpid(),'status':'running','folder':str(folder),'app':str(app),'sourceHashes':manifest,'scope':'Isolated fresh candidate Next build with6 overlay files; no root mutations, no .env or provider credentials, only public Google Fonts GETs permitted; provider/database networking blocked. Not full frozen gate or production proof. Built artifact retained only for forthcoming isolated authenticated API test.'};report=base/'hr-department-operation-candidate-build.json';report.write_text(json.dumps(state,indent=2)+'\n')
try:
 with (base/'hr-department-operation-candidate-build.log').open('w') as log:
  child=subprocess.run(['node',str(root/'node_modules/next/dist/bin/next'),'build',str(app)],cwd=app,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=900)
 state['exitCode']=child.returncode;state['sourcesUnchanged']=all(pathlib.Path(p).is_file() and sha(pathlib.Path(p))==h for p,h in manifest.items());state['buildIdExists']=(app/'.next/BUILD_ID').is_file();state['status']='passed' if child.returncode==0 and state['sourcesUnchanged'] and state['buildIdExists'] else 'failed'
except BaseException as error:
 state.update(status='failed',exceptionType=type(error).__name__)
finally:
 state['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps({k:v for k,v in state.items() if k!='sourceHashes'}))
if state['status']!='passed':raise SystemExit(1)
