import pathlib,json,subprocess,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'promane-canonical-operation-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==94 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
e2e=json.loads((base/'promane-registration-next-e2e-results.json').read_text()); e2eState=json.loads((base/'promane-registration-next-e2e-supervisor.json').read_text());assert e2eState['status']=='passed' and e2eState['evidenceValid'] and e2eState['stopExitCode']==0 and e2e['expected']==13 and e2e['passed']==13 and len(e2e['cases'])==13 and all(pathlib.Path(name).is_file() and __import__('hashlib').sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in e2e['sourceHashes'].items())
canonical=json.loads((base/'promane-canonical-scope-next-results.json').read_text());assert canonical['expected']==5 and canonical['passed']==5 and len(canonical['cases'])==5 and canonical['checkedAt']>=e2eState['startedAt'] and all(pathlib.Path(name).is_file() and __import__('hashlib').sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in canonical['sourceHashes'].items())
family=json.loads((base/'promane-registration-family-next-results.json').read_text());assert family['expected']==16 and family['passed']==16 and len(family['cases'])==16 and family['checkedAt']>=e2eState['startedAt'] and all(pathlib.Path(name).is_file() and __import__('hashlib').sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in family['sourceHashes'].items())
navigation=json.loads((base/'promane-canonical-navigation-mounted-results.json').read_text());assert navigation['expected']==20 and navigation['passed']==20 and len(navigation['cases'])==20 and all(pathlib.Path(name).is_file() and __import__('hashlib').sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in navigation['sourceHashes'].items())
allow=set(json.loads((base/'promane-canonical-operation-release-allowlist.json').read_text())['files'])
changedSourceFiles=(set(run(['git','diff','--name-only','HEAD']).splitlines()) | set(run(['git','ls-files','--others','--exclude-standard']).splitlines())) & set(expected)
assert changedSourceFiles <= allow, 'Frozen source changes outside the reviewed release allowlist'
assert not run(['git','diff','--cached','--name-only'])
assert run(['git','rev-parse','HEAD'])==state['head']
assert run(['git','ls-remote','origin','refs/heads/main']).split()[0]==state['head'], 'Remote main advanced; integrate and reverify before publishing'
subprocess.run(['git','diff','--check','--','src','scripts'],check=True)
planpath=base/'promane-canonical-scope-repair-plan.json';plan=json.loads(planpath.read_text());plan['status']='frozen94-and-actual-next34-and-navigation20-passed-ready-for-reviewed-commit-push';plan['gateStatus']='passed';planpath.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['git','add','--',*sorted(allow)],check=True)
staged=set(run(['git','diff','--cached','--name-only']).splitlines());assert staged and staged<=allow
assert {'src/components/promane/create-workspace-button.tsx','src/components/promane/workspace-settings-form.tsx','src/lib/promane/workspace-operation.ts','src/lib/promane/workspace-mutations.ts','src/lib/promane/use-workspace-operation.ts','src/app/api/promane/workspaces/recover/route.ts','.github/workflows/ci.yml'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(promane): bind recovery to workspace IDs and fence legacy sends'],check=True)
commit=run(['git','rev-parse','HEAD']);changed=set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines());assert changed==staged and changed<=allow
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed94gates-unchanged','commitChangedFiles':sorted(changed),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Promane explicit workspace creation/settings: atomic operation result with workspace/owner membership, preserved owner caps and manager authority, optimistic revision and terminal stale/slug/limit declines, metadata-only lost-ack recovery/cancel and canonical workspace ID. Projects/tasks/expenses/clients/time use immutable workspace scope with actor-bound legacy migration and cancellation fencing. Original open tabs recover to the current workspace URL. Frozen94 gate, authenticated local Next/PostgreSQL34 and strict canonical acknowledgement20 pass. Full17service audit, remaining full-service cases and authenticated deployed writes remain pending.'}
p=base/'promane-canonical-operation-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
