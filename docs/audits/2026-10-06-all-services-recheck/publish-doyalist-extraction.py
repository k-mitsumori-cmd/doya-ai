import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'doyalist-extraction-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==124 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
reports=[('doyalist-extraction-helper-postgres-results.json', 19), ('doyalist-operation-route-postgres-results.json', 27), ('doyalist-extraction-mounted-results.json', 8), ('doyalist-extraction-cancel-mounted-results.json', 11), ('doyalist-extraction-native-results.json', 9), ('doyalist-next-extraction-results.json', 7)]
for filename,count in reports:
 report=json.loads((base/filename).read_text())
 assert report['passed']==count and len(report.get('cases',report.get('checks',[])))==count and report.get('expected',count)==count
 assert report['checkedAt']>=state['startedAt']
 assert report['sourceHashes'] and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in report['sourceHashes'].items())
for name in ['doyalist-extraction-helper-postgres','doyalist-operation-route-postgres','doyalist-next-extraction']:
 proof=json.loads((base/(name+'-supervisor.json')).read_text())
 assert proof['status']=='passed' and proof['probeExitCode']==0 and proof['evidenceValid'] and proof['stopExitCode']==0 and proof['postStopStatusExitCode']==3 and proof['privateFolderRemoved']
assert json.loads((base/'doyalist-next-extraction-results.json').read_text())['buildId']==pathlib.Path('.next/BUILD_ID').read_text().strip()

allow=set(json.loads((base/'doyalist-extraction-release-allowlist.json').read_text())['files'])
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
assert {'src/lib/doyalist/extraction-intent-client.ts', 'src/app/api/doyalist/collect/route.ts', 'src/lib/doyalist/extraction-response.ts', 'src/app/api/doyalist/operations/route.ts', 'src/lib/doyalist/extraction-operation.ts', 'src/lib/doyalist/collect-response-client.ts', 'src/app/doyalist/Tool.tsx', 'src/app/api/doyalist/projects/route.ts'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(doyalist): recover extraction and fence cancelled work'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed124-unchanged-including-native-next7','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Doyalist actor-bound UUID preparation, monthly reservations, atomic save/completion, criteria hash fencing, immediate cancellation and GET-only recovery. Full17services2074 audit and authenticated production extraction remain incomplete.'}
p=base/'doyalist-extraction-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
