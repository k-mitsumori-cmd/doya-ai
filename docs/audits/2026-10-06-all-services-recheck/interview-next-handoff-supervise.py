import pathlib,os,subprocess,json,datetime,time,hashlib,socket,urllib.request
b=pathlib.Path('docs/audits/2026-10-06-all-services-recheck');g=pathlib.Path((b/'interview-generation-current-gate.txt').read_text().strip());report=b/'interview-next-handoff-supervisor.json';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();state={'startedAt':now(),'pid':os.getpid(),'gate':str(g),'status':'waiting_for_exact_gate'};report.write_text(json.dumps(state,indent=2)+'\n');server=None
try:
 deadline=time.monotonic()+1200
 while True:
  gate=json.loads((g/'state.json').read_text())
  if gate['status']!='running':break
  os.kill(gate['pid'],0)
  if time.monotonic()>deadline:raise RuntimeError('Exact gate observation timed out; do not restart gate')
  time.sleep(2)
 assert gate['status']=='passed' and len(gate['gates'])==118 and not gate['changedSources']
 manifest=json.loads((g/'source-manifest.json').read_text());assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in manifest.items())
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 origin='http://127.0.0.1:'+str(port)
 env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG','LC_ALL']};env.update(NODE_ENV='production',NEXTAUTH_URL=origin,NEXTAUTH_SECRET='synthetic-interview-next-local-only',DATABASE_URL='postgresql://synthetic:synthetic@127.0.0.1:1/no_customer_db',DIRECT_URL='postgresql://synthetic:synthetic@127.0.0.1:1/no_customer_db',NEXT_TELEMETRY_DISABLED='1')
 with (b/'interview-next-handoff-server.log').open('w') as out:
  server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(port)],env=env,stdout=out,stderr=subprocess.STDOUT)
  state.update(status='server_starting',serverPid=server.pid,origin=origin);report.write_text(json.dumps(state,indent=2)+'\n')
  for _ in range(100):
   if server.poll() is not None:raise RuntimeError('Local Next exited before readiness')
   try:
    with urllib.request.urlopen(origin+'/robots.txt',timeout=2) as response:
     if response.status==200:break
   except Exception:time.sleep(.2)
  else:raise RuntimeError('Local Next readiness failed')
  env['DOYA_INTERVIEW_NEXT_URL']=origin
  with (b/'interview-next-handoff.log').open('w') as out:result=subprocess.run(['node',str(b/'verify-interview-next-handoff.cjs')],env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180)
  evidence=json.loads((b/'interview-next-handoff-results.json').read_text()) if (b/'interview-next-handoff-results.json').exists() else {};valid=evidence.get('passed')==6 and len(evidence.get('cases',[]))==6 and evidence.get('checkedAt','')>=state['startedAt'] and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in evidence.get('sourceHashes',{}).items()) and len(evidence.get('sourceHashes',{}))==9
  state.update(status='passed' if result.returncode==0 and valid else 'failed',probeExitCode=result.returncode,evidenceValid=valid)
finally:
 if server is not None:
  if server.poll() is None:server.terminate()
  try:server.wait(timeout=15)
  except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
  state.update(serverExitCode=server.returncode,serverStopped=server.poll() is not None)
 state['endedAt']=now();report.write_text(json.dumps(state,indent=2)+'\n');print(json.dumps(state))
if state['status']!='passed':raise SystemExit(1)
