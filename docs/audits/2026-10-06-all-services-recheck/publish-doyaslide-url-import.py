import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'doyaslide-url-import-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==106 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
for filename,count in [('doyaslide-url-import-mounted-results.json',25),('doyaslide-url-import-native-results.json',13),('doyaslide-url-operation-postgres-results.json',26),('doyaslide-url-route-postgres-results.json',15),('doyaslide-url-intent-client-results.json',14),('doyaslide-url-operation-transport-results.json',26),('doyaslide-url-analysis-route-results.json',6),('doyaslide-url-analysis-transport-results.json',19),('doyaslide-url-native-api-postgres-results.json',8)]:
 report=json.loads((base/filename).read_text())
 assert report['expected']==count and report['passed']==count and len(report['cases'])==count
 assert report['checkedAt']>=state['startedAt']
 assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==value for p,value in report['sourceHashes'].items())
allow=set(json.loads((base/'doyaslide-url-import-release-allowlist.json').read_text())['files'])
changed=(set(run(['git','diff','--name-only','HEAD']).splitlines())|set(run(['git','ls-files','--others','--exclude-standard']).splitlines()))&set(expected)
assert changed<=allow,'Unreviewed frozen source change'
assert not run(['git','diff','--cached','--name-only'])
assert run(['git','rev-parse','HEAD'])==state['head']
assert run(['git','ls-remote','origin','refs/heads/main']).split()[0]==state['head'],'Remote advanced; integrate and reverify before release'
assert all(pathlib.Path(p).is_file() for p in allow)
subprocess.run(['git','diff','--check','--',*sorted(allow)],check=True)
planpath=base/'doyaslide-url-import-repair-plan.json';plan=json.loads(planpath.read_text())
plan.update(status='frozen106-and-local-native13-passed-ready-for-reviewed-commit-push',nextGateStatus='passed106-unchanged',publicationStatus='ready-not-yet-pushed')
planpath.write_text(json.dumps(plan,indent=2)+'\n')
subprocess.run(['git','add','--',*sorted(allow)],check=True)
staged=set(run(['git','diff','--cached','--name-only']).splitlines());assert staged and staged<=allow
assert {'src/components/doyaslide/NewDoyaSlideWizard.tsx','src/app/api/doyaslide/analyze/route.ts','src/lib/doyaslide/url-analysis-operation.ts','src/lib/doyaslide/url-analysis-intent-client.ts','src/lib/doyaslide/url-analysis-operation-client.ts','scripts/security-regression/verify-slide-wizard-usage-mounted.cjs','.github/workflows/ci.yml'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(doyaslide): recover URL analysis without duplicate attempts'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed106-unchanged','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Slide reference URL analysis: durable actor-bound UUID receipts, atomic attempt reservation, recovery and cancellation, metadata-only tab locking, bounded protocol responses and draft-safe adoption. Full106 frozen gates include security/types/build/lint and native browser. All17-service audit and authenticated production flows remain incomplete.'}
p=base/'doyaslide-url-import-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
