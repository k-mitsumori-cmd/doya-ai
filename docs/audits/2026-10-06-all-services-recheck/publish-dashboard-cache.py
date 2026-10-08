import pathlib,json,subprocess,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'dashboard-cache-current-gate.txt').read_text().strip())
def run(args):return subprocess.check_output(args,text=True).strip()
def snapshot():
 ns={'__file__':str((gate/'supervise.py').resolve())}
 exec((gate/'supervise.py').read_text().split('manifest=snapshot()')[0],ns)
 return ns['snapshot']()
assert json.loads((base/'dashboard-cache-release-allowlist.json').read_text()).get('releaseReady') is True, 'Release has a pending independent repair'
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==149 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
expected=json.loads((gate/'source-manifest.json').read_text());assert snapshot()==expected
reports=json.loads((base/'dashboard-cache-release-allowlist.json').read_text())['reports']
for filename,count in reports:
 report=json.loads((base/filename).read_text())
 items=report.get('cases',report.get('checks',report.get('observations',[])))
 if 'keyboard' in report:items=list(report['observations'])+list(report['keyboard'])
 assert report['passed']==count and len(items)==count and report.get('expected',count)==count
 assert report['checkedAt']>=state['startedAt']
 hashes=report.get('sourceHashes') or {report['source']:report['sourceHash']}
 assert hashes and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
review=json.loads((base/'dashboard-cache-release-review.json').read_text());assert review.get('compiledMarkerProof') and all(review['compiledMarkerProof']['checks'].values())
proof=review['compiledMarkerProof'];assert all(pathlib.Path(f).is_file() and hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()==h for f,h in proof['assets'].items());assert len(proof['apiEntries'])==4 and all(pathlib.Path(entry['file']).is_file() and hashlib.sha256(pathlib.Path(entry['file']).read_bytes()).hexdigest()==entry['hash'] for entry in proof['apiEntries'])
previous=json.loads((base/'seo-template-release-tracking.json').read_text())
assert previous['commit']==state['head'] and previous['observerStatus']=='passed' and previous['ci']['conclusion']=='success' and previous['deployment']['readyState']=='READY' and previous['publicVerificationExitCode']==0, 'Prior release not verified'

allow=set(json.loads((base/'dashboard-cache-release-allowlist.json').read_text())['files'])
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
assert {'src/app/api/hr/settings/route.ts', 'docs/audits/2026-10-06-all-services-recheck/verify-membership-onboarding-role-integrated-postgres.cjs', 'scripts/security-regression/verify-hr-one-on-one-month.cjs', 'scripts/security-regression/verify-hr-additional-get-cache.cjs', 'src/app/api/hr/organization/route.ts', 'scripts/security-regression/verify-kintai-read-only.cjs', 'scripts/security-regression/verify-hr-organization-updates.cjs', 'scripts/security-regression/verify-personalized-dashboard-cache.cjs', 'src/app/api/kintai/dashboard/route.ts', 'src/lib/private-api-response.ts', 'scripts/security-regression/verify-kintai-overnight.cjs', 'src/app/api/hr/dashboard/route.ts', 'scripts/security-regression/run.cjs', 'scripts/security-regression/verify-hr-error-sanitization.cjs', 'scripts/security-regression/verify-hr-employee-reads.cjs', 'scripts/security-regression/verify-hr-kintai-onboarding.cjs', 'scripts/security-regression/verify-hr-evaluation-related-reads.cjs', 'scripts/security-regression/verify-hr-one-on-one-related.cjs'}<=staged
assert snapshot()==expected
subprocess.run(['git','commit','-m','fix(api): prevent caching of personalized HR and attendance responses'],check=True)
commit=run(['git','rev-parse','HEAD']);assert set(run(['git','diff-tree','--no-commit-id','--name-only','-r',commit]).splitlines())==staged
assert snapshot()==expected
tracking={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'gate':str(gate),'gateStatus':'passed149-unchanged-including-actual-next-private-cache17','commitChangedFiles':sorted(staged),'commitExitCode':0,'sourceSnapshotRecheckedAfterCommit':True,'pushStatus':'not-yet-pushed','scope':'Five production files: four personalized HR/Kintai GET handlers use shared private no-store/Cookie Vary helper. Business query, authorization, quota and mutation bodies preserved. Actual Next/isolated PostgreSQL17 checks required. Full17services2074 audit and authenticated production provider execution remain incomplete.'}
p=base/'dashboard-cache-release-tracking.json';p.write_text(json.dumps(tracking,indent=2)+'\n')
subprocess.run(['git','push','origin','HEAD:main'],check=True)
tracking.update(pushExitCode=0,pushStatus='pushed',checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());p.write_text(json.dumps(tracking,indent=2)+'\n');print(json.dumps(tracking))
