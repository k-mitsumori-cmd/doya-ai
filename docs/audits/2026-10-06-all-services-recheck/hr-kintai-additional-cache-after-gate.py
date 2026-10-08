import pathlib,json,subprocess,os,time,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'hr-kintai-additional-cache-current-gate.txt').read_text().strip())
report=base/'hr-kintai-additional-cache-after-gate.json'
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(**values):report.write_text(json.dumps(dict(startedAt=started,gate=str(gate),**values),indent=2)+'\n')
save(status='waiting-for-existing-full150')
deadline=time.monotonic()+2400
while True:
 state=json.loads((gate/'state.json').read_text())
 if state['status']=='passed':
  assert len(state['gates'])==150 and all(x['exitCode']==0 for x in state['gates']) and not state['changedSources']
  save(status='running-actual-next20')
  result=subprocess.run(['python3',str(base/'hr-kintai-additional-cache-next-supervise.py')],timeout=360)
  save(status='passed' if result.returncode==0 else 'failed',nextExitCode=result.returncode,endedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
  raise SystemExit(result.returncode)
 if state['status']!='running':
  save(status='failed-gate',gateStatus=state['status']);raise SystemExit(1)
 try:os.kill(state['pid'],0)
 except ProcessLookupError:
  save(status='gate-handle-missing');raise SystemExit(1)
 if time.monotonic()>deadline:
  save(status='observation-timeout-existing-gate-not-stopped');raise SystemExit(1)
 time.sleep(5)
