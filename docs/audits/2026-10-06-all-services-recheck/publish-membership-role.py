import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'membership-role-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
assert json.loads((base/'membership-role-release-allowlist.json').read_text()).get('releaseReady') is True, 'Release has a pending independent repair'
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==141 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
reports=json.loads((base/'membership-role-release-allowlist.json').read_text())['reports']
for filename,count in reports:
 report=json.loads((base/filename).read_text())
 assert report['passed']==count and len(report.get('cases',report.get('checks',report.get('observations',[]))))==count and report.get('expected',count)==count
 assert report['checkedAt']>=state['startedAt']
 hashes=report.get('sourceHashes') or {report['source']:report['sourceHash']}
 assert hashes and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
for name in ['membership-known-role-integrated-postgres','membership-aio-operation-integrated-postgres','membership-invitation-role-integrated-postgres','membership-additional-invite-integrated-postgres','promane-known-read-receipt-role-integrated-candidate-postgres','membership-onboarding-role-integrated-candidate-postgres']:
 proof=json.loads((base/(name+'-supervisor.json')).read_text())
 assert proof['status']=='passed' and proof['probeExitCode']==0 and proof['evidenceValid'] and proof['stopExitCode']==0 and proof['postStopStatusExitCode']==3 and proof['privateFolderRemoved']
 assert proof['startedAt']>=state['startedAt']

allow=set(json.loads((base/'membership-role-release-allowlist.json').read_text())['files'])
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
assert {'.github/workflows/ci.yml','src/lib/aio/access.ts','src/lib/promane/auth.ts','src/lib/promane/workspace-mutations.ts'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(auth): reject unknown membership and invitation roles'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed141-unchanged-including-native-and-next','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Known membership roles across9services; invitation validation; Promane independent listing/timesheet/page/creation receipt read boundaries. Full17services2074 audit and authenticated production provider execution remain incomplete.'}
p=base/'membership-role-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
