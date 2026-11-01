import pathlib,json,subprocess,time,os,datetime
base=pathlib.Path('docs/audits/2026-10-06-all-services-recheck');gate=pathlib.Path((base/'seo-durable-current-gate.txt').read_text().strip())
for attempt in range(90):
 state=json.loads((gate/'state.json').read_text())
 if state['status']!='running':break
 command=subprocess.run(['ps','-p',str(state['pid']),'-o','command='],text=True,capture_output=True)
 if command.returncode or str(gate/'supervise.py') not in command.stdout:raise RuntimeError('Frozen gate supervisor no longer live; inspect exact gate session before recovery')
 time.sleep(10)
else:raise RuntimeError('Bounded observation expired; inspect original live gate, never restart from this timeout alone')
assert state['status']=='passed' and len(state['gates'])==150 and not state['changedSources'],state['status']
print('Frozen150passed; starting actual Next SEO19 proof',flush=True)
result=subprocess.run(['python3',str(base/'seo-durable-next-supervise.py')],env={**os.environ,'DOYA_FROZEN_GATE_POINTER':str((base/'seo-durable-current-gate.txt').resolve())})
raise SystemExit(result.returncode)
