import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'interview-generation-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==118 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
reports=[('interview-article-input-client-results.json',17),('interview-article-intent-client-results.json',15),('interview-article-operation-client-results.json',25),('interview-article-operation-postgres-results.json',30),('interview-article-recovery-mounted-results.json',24),('interview-article-route-postgres-results.json',21),('interview-article-stream-client-results.json',30),('interview-budget-corruption-postgres-results.json',14),('interview-input-navigation-native-results.json',8),('interview-native-api-postgres-results.json',9),('interview-provider-terminal-postgres-results.json',10),('interview-skill-selection-recovery-results.json',18),('interview-next-handoff-results.json',6)]
for filename,count in reports:
 report=json.loads((base/filename).read_text())
 assert report['passed']==count and len(report['cases'])==count and report.get('expected',count)==count
 assert report['checkedAt']>=state['startedAt']
 assert report['sourceHashes'] and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in report['sourceHashes'].items())
for name in ['article-operation','article-route','budget-corruption','native-api','provider-terminal']:
 proof=json.loads((base/('interview-'+name+'-postgres-supervisor.json')).read_text())
 assert proof['status']=='passed' and proof['probeExitCode']==0 and proof['evidenceValid'] and proof['stopExitCode']==0 and proof['postStopStatusExitCode']==3 and proof['privateFolderRemoved']
nextProof=json.loads((base/'interview-next-handoff-supervisor.json').read_text());assert nextProof['status']=='passed' and nextProof['evidenceValid'] and nextProof['serverStopped']
assert json.loads((base/'interview-next-handoff-results.json').read_text())['buildId']==pathlib.Path('.next/BUILD_ID').read_text().strip()
allow=set(json.loads((base/'interview-generation-release-allowlist.json').read_text())['files'])
changed=(set(run(['git','diff','--name-only','HEAD']).splitlines())|set(run(['git','ls-files','--others','--exclude-standard']).splitlines()))&set(expected)
assert changed<=allow,'Unreviewed frozen source change'
assert not run(['git','diff','--cached','--name-only'])
assert run(['git','rev-parse','HEAD'])==state['head']
assert run(['git','ls-remote','origin','refs/heads/main']).split()[0]==state['head'],'Remote advanced; integrate and reverify before release'
assert all(pathlib.Path(p).is_file() for p in allow)
subprocess.run(['git','diff','--check','--',*sorted(allow)],check=True)
assert snapshot()==expected
subprocess.run(['git','add','--',*sorted(allow)],check=True)
staged=set(run(['git','diff','--cached','--name-only']).splitlines());assert staged and staged<=allow
assert {'src/app/api/interview/articles/generate/route.ts','src/app/interview/projects/[id]/generate/page.tsx','src/app/interview/projects/[id]/recipe/page.tsx','src/app/interview/projects/[id]/skill/page.tsx','src/lib/interview/article-budget.ts','src/lib/interview/guest-claim.ts','src/lib/interview/article-operation.ts','src/lib/interview/article-operation-client.ts','src/lib/interview/article-stream-client.ts','src/lib/interview/article-intent-client.ts','src/lib/interview/article-input-client.ts','src/lib/interview/use-article-input-navigation.ts','scripts/security-regression/verify-interview-article-limit.cjs'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(interview): recover article generation and reject incomplete output'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed118-unchanged-plus-native-next6','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Interview durable article UUID receipts, atomic attempt budget/refund/completion, cancellation fencing, private browser-memory instructions, bounded stream/recovery protocol and normal provider STOP requirement. Full17-service2074 audit and authenticated production flows remain incomplete.'}
p=base/'interview-generation-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
