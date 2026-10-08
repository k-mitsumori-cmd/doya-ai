import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'doyaslide-preview-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==98 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
for name,count in [('transport',21),('hook-mounted',7),('wizard-mounted',7),('native',7)]:
 report=json.loads((base/f'doyaslide-preview-{name}-results.json').read_text())
 assert report['expected']==count and report['passed']==count and len(report['cases'])==count
 assert report['checkedAt']>=state['startedAt']
 assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==value for p,value in report['sourceHashes'].items())
allow=set(json.loads((base/'doyaslide-preview-release-allowlist.json').read_text())['files'])
changed=(set(run(['git','diff','--name-only','HEAD']).splitlines())|set(run(['git','ls-files','--others','--exclude-standard']).splitlines()))&set(expected)
assert changed<=allow,'Unreviewed frozen source change'
assert not run(['git','diff','--cached','--name-only'])
assert run(['git','rev-parse','HEAD'])==state['head']
assert run(['git','ls-remote','origin','refs/heads/main']).split()[0]==state['head'],'Remote advanced; integrate and reverify before release'
assert all(pathlib.Path(p).is_file() for p in allow)
subprocess.run(['git','diff','--check','--',*sorted(allow)],check=True)
planpath=base/'doyaslide-preview-client-repair-plan.json';plan=json.loads(planpath.read_text())
plan.update(status='frozen98-and-local-native7-passed-ready-for-reviewed-commit-push',nextGateStatus='passed98-unchanged',publicationStatus='ready-not-yet-pushed')
planpath.write_text(json.dumps(plan,indent=2)+'\n')
subprocess.run(['git','add','--',*sorted(allow)],check=True)
staged=set(run(['git','diff','--cached','--name-only']).splitlines());assert staged and staged<=allow
assert {'src/components/doyaslide/NewDoyaSlideWizard.tsx','src/lib/doyaslide/style-preview-client.ts','src/lib/doyaslide/use-style-previews.ts','scripts/security-regression/verify-slide-wizard-usage-mounted.cjs','.github/workflows/ci.yml'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(doyaslide): bound preview loading and preserve retry recovery'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed98-unchanged','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Slide style previews: bounded headers/body, response validation, finite polling, scope cancellation, explicit empty/error/cap/retry, draft and valid preview preservation, narrow URL input. Full98 frozen gates include security/types/build/lint and local native browser. All17-service audit and authenticated production flows remain incomplete.'}
p=base/'doyaslide-preview-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
