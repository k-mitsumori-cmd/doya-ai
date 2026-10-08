import pathlib,json,subprocess,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'promane-workspace-operation-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==91 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
e2e=json.loads((base/'promane-workspace-next-e2e-results.json').read_text()); e2eState=json.loads((base/'promane-workspace-next-e2e-supervisor.json').read_text());assert e2eState['status']=='passed' and e2eState['evidenceValid'] and e2eState['stopExitCode']==0 and e2e['expected']==13 and e2e['passed']==13 and len(e2e['cases'])==13 and all(pathlib.Path(name).is_file() and __import__('hashlib').sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in e2e['sourceHashes'].items())
allow=set(json.loads((base/'promane-workspace-operation-release-allowlist.json').read_text())['files'])
assert not run(['git','diff','--cached','--name-only'])
assert run(['git','rev-parse','HEAD'])==state['head']
subprocess.run(['git','diff','--check','--','src','scripts'],check=True)
planpath=base/'promane-workspace-operation-repair-plan.json';plan=json.loads(planpath.read_text());plan['status']='frozen91gates-passed-ready-for-reviewed-commit-push';plan['gateStatus']='passed';planpath.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['git','add','--',*sorted(allow)],check=True)
staged=set(run(['git','diff','--cached','--name-only']).splitlines());assert staged and staged<=allow
assert {'src/components/promane/create-workspace-button.tsx','src/components/promane/workspace-settings-form.tsx','src/lib/promane/workspace-operation.ts','src/lib/promane/workspace-mutations.ts','src/lib/promane/use-workspace-operation.ts','src/app/api/promane/workspaces/recover/route.ts','.github/workflows/ci.yml'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(promane): recover workspace writes and reject stale settings'],check=True)
commit=run(['git','rev-parse','HEAD']);changed=set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines());assert changed==staged and changed<=allow
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed91gates-unchanged','commitChangedFiles':sorted(changed),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Promane explicit workspace creation/settings: atomic operation result with workspace/owner membership, preserved owner caps and manager authority, optimistic revision and terminal stale/slug/limit declines, metadata-only lost-ack recovery/cancel and canonical workspace ID. Frozen91 gate and authenticated local Next/PostgreSQL13 pass. Full17service audit, older slug-key recovery hooks and authenticated deployed writes remain pending.'}
p=base/'promane-workspace-operation-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
