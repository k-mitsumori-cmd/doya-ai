import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'seo-template-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
assert json.loads((base/'seo-template-release-allowlist.json').read_text()).get('releaseReady') is True, 'Release has a pending independent repair'
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==146 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
reports=json.loads((base/'seo-template-release-allowlist.json').read_text())['reports']
for filename,count in reports:
 report=json.loads((base/filename).read_text())
 items=report.get('cases',report.get('checks',report.get('observations',[])))
 if 'keyboard' in report:items=list(report['observations'])+list(report['keyboard'])
 assert report['passed']==count and len(items)==count and report.get('expected',count)==count
 assert report['checkedAt']>=state['startedAt']
 hashes=report.get('sourceHashes') or {report['source']:report['sourceHash']}
 assert hashes and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
review=json.loads((base/'seo-template-release-review.json').read_text());assert review.get('compiledMarkerProof') and all(review['compiledMarkerProof']['checks'].values())
proof=review['compiledMarkerProof'];assert all(pathlib.Path(f).is_file() and hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()==h for f,h in proof['assets'].items());assert hashlib.sha256(pathlib.Path(proof['apiEntry']['file']).read_bytes()).hexdigest()==proof['apiEntry']['hash']
previous=json.loads((base/'banner-scope-release-tracking.json').read_text())
assert previous['commit']==state['head'] and previous['observerStatus']=='passed' and previous['ci']['conclusion']=='success' and previous['deployment']['readyState']=='READY' and previous['publicVerificationExitCode']==0, 'Prior release not verified'

allow=set(json.loads((base/'seo-template-release-allowlist.json').read_text())['files'])
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
assert {'src/app/seo/template/page.tsx','src/lib/seo-template-requests.ts','scripts/security-regression/verify-seo-template-actor-mounted.cjs','scripts/security-regression/run.cjs','src/components/limits/ServiceLimitProvider.tsx','scripts/security-regression/verify-service-limit-provider-mounted.cjs','src/app/api/seo/entitlements/route.ts','scripts/security-regression/verify-seo-entitlements-ledger.cjs'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(seo): isolate request state and protect usage responses'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed146-unchanged-including-seo-template-native-and-next','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Four production files: private entitlement cache policy, shared service-plan notice scope and SEO template actor/plan lifecycle isolation, synchronous request guards, validated responses and current-workspace creation recovery. Full17services2074 audit and authenticated production provider execution remain incomplete.'}
p=base/'seo-template-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
