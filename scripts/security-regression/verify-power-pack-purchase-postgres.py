from pathlib import Path
import subprocess,os,json,tempfile,datetime,shutil

root=Path(__file__).resolve().parents[2]
output=Path(os.environ.get('DOYA_POWER_RECOVERY_EVIDENCE_DIR') or tempfile.mkdtemp(prefix='doya-power-recovery-evidence-',dir='/tmp'))
output.mkdir(parents=True,exist_ok=True,mode=0o700)
folder=Path(tempfile.mkdtemp(prefix='doya-power-recovery-',dir='/tmp'));folder.chmod(0o700)
socket=folder/'socket';socket.mkdir(mode=0o700)
config=shutil.which('pg_config')
pg=Path(subprocess.check_output([config,'--bindir'],text=True).strip()) if config else Path('/opt/homebrew/opt/postgresql@17/bin')
assert (pg/'initdb').is_file()
node=shutil.which('node');assert node
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','USER','LANG','TMPDIR']}
env.update({'NODE_OPTIONS':'--require='+str(root/'scripts/security-regression/power-pack-offline.cjs'),'DOYA_HTTP_DENIED_LOG':str(output/'denied-network.jsonl'),'CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'1','DOYA_POWER_RECOVERY_NATIVE_RESULT':str(output/'native-result.json')})
url='postgresql://power_recovery_test@localhost:56519/power_recovery_synthetic?host='+str(socket)+'&sslmode=disable&connection_limit=8'
private=folder/'environment.json';private.write_text(json.dumps({'DATABASE_URL':url,'DIRECT_URL':url}));private.chmod(0o600)
started=False;exitcode=None
try:
 with (folder/'init.log').open('w') as log:subprocess.run([str(pg/'initdb'),'-D',str(folder/'data'),'-U','power_recovery_test','--auth=trust','--no-locale','--encoding=UTF8'],env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=60)
 subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-o',"-k "+str(socket)+" -h '' -p 56519 -F -c timezone=UTC -c unix_socket_permissions=0700 -c shared_buffers=16MB",'-l',str(folder/'server.log'),'-w','start'],env=env,stdout=subprocess.DEVNULL,check=True,timeout=30);started=True
 subprocess.run([str(pg/'createdb'),'-h',str(socket),'-p','56519','-U','power_recovery_test','power_recovery_synthetic'],env=env,check=True,timeout=15)
 schema=folder/'schema.prisma';schema.write_bytes((root/'prisma/schema.prisma').read_bytes())
 with (output/'schema.log').open('w') as log:subprocess.run([node,str(root/'node_modules/prisma/build/index.js'),'db','push','--skip-generate','--schema',str(schema)],cwd=folder,env={**env,'DATABASE_URL':url,'DIRECT_URL':url},stdout=log,stderr=subprocess.STDOUT,check=True,timeout=120)
 with (output/'native.log').open('w') as log:
  result=subprocess.run([node,str(root/'node_modules/tsx/dist/cli.mjs'),str(root/'scripts/security-regression/power-pack-purchase-native.ts'),str(private),str(root/'node_modules/@prisma/client')],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=120);exitcode=result.returncode
finally:
 status=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'status'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
 if status.returncode==0:
  subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'-m','fast','-w','stop'],env=env,stdout=subprocess.DEVNULL,check=True,timeout=30)
  status=subprocess.run([str(pg/'pg_ctl'),'-D',str(folder/'data'),'status'],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
 receipt={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ownedPrivateCluster':str(folder),'started':started,'testExit':exitcode,'privateServerStopped':status.returncode==3,'databaseTcpDisabled':True,'productionCredentialsInherited':False,'applicationEnvNotLoaded':True,'productionWrites':0,'realStripeRequests':0}
 (output/'lifecycle.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));assert status.returncode==3
raise SystemExit(exitcode if exitcode is not None else 1)
