import pathlib, json, hashlib, datetime, subprocess, ast
base=pathlib.Path('docs/audits/2026-10-06-all-services-recheck')
gate=pathlib.Path((base/'hr-department-input-current-gate.txt').read_text().strip())
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==163 and all(g['exitCode']==0 for g in state['gates']) and not state['changedSources']
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
manifest=json.loads((gate/'source-manifest.json').read_text());assert all(pathlib.Path(p).is_file() and sha(p)==h for p,h in manifest.items())
# Preserve every prior gate in order, including the original150 and org-chart six.
prior=pathlib.Path((base/'hr-org-chart-pagination-current-gate.txt').read_text().strip())
def steps(p):
 tree=ast.parse((p/'supervise.py').read_text());loop=next(n for n in tree.body if isinstance(n,ast.For) and ast.unparse(n.target)=='(name, args)');return ast.literal_eval(loop.iter)
assert len(steps(prior))==156 and steps(gate)[:156]==steps(prior)
report=json.loads((base/'hr-department-input-next-results.json').read_text())
assert report['expected']==53 and report['passed']==53 and len(report['cases'])==53 and report['checkedAt']>=state['startedAt']
assert len(report['sourceHashes'])==17 and all(sha(p)==h for p,h in report['sourceHashes'].items())
supervisor=json.loads((base/'hr-department-input-next-supervisor.json').read_text())
assert supervisor['status']=='passed' and supervisor['evidenceValid'] and supervisor['stopExitCode']==0 and supervisor['postStopStatusExitCode']==3 and supervisor['privateFolderRemoved'] and supervisor['startedAt']>=state['startedAt']
production=['src/lib/hr/department-input.ts','src/lib/hr/department-mutation.ts','src/app/api/hr/departments/route.ts','src/app/api/hr/departments/[id]/route.ts']
regression=['scripts/security-regression/'+n for n in ['run.cjs','verify-related-records.cjs','verify-hr-department-access.cjs','verify-hr-department-input.cjs','verify-hr-department-private-cache.cjs']]
primary=production+regression
run=lambda *args:subprocess.check_output(['git',*args],text=True).strip()
changed=set(run('diff','--name-only','HEAD').splitlines())|set(run('ls-files','--others','--exclude-standard').splitlines())
assert {p for p in changed if p.startswith(('src/','scripts/','reference/'))}==set(primary)
for name in ['prisma/schema.prisma','package.json','package-lock.json']:assert pathlib.Path(name).read_bytes()==subprocess.check_output(['git','show','HEAD:'+name])
for name in production:assert pathlib.Path(name).read_bytes()==(base/'hr-department-input-repair-overlay'/name).read_bytes()
entries=[pathlib.Path('.next/server/app/api/hr/departments/route.js'),pathlib.Path('.next/server/app/api/hr/departments/[id]/route.js')]
assert all(p.is_file() for p in entries)
assets={str(p):sha(p) for p in entries}
compiled=[p for p in pathlib.Path('.next/server').rglob('*.js') if '部署の入力内容をご確認ください' in p.read_text()]
assert compiled, 'Compiled department input rejection is absent'
assets.update({str(p):sha(p) for p in compiled})
scope='HR department input validation and serialized organization/membership/department mutation locks. Production4 and mandatory regression5; original156 preserved plus7, full163, actualNext53, realPG47. No schema/dependency/customer DB/provider changes. Settings response-loss and durable creation are separately reproduced, remain incomplete and are not part of this release. Full17services2074criteria188GET audit remains active.'
review={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gate':str(gate),'reviewStatus':'full163-and-actualNext53-passed-awaiting-exact-publish','productionFiles':production,'regressionFiles':regression,'requiredPrimaryFiles':primary,'sourceHashes':{p:sha(p) for p in primary},'compiledMarkerProof':{'checks':{'full163':True,'original156Preserved':True,'frozenSourcesUnchanged':True,'actualNext53':True,'isolatedDatabaseStoppedAndRemoved':True,'departmentInputCompiled':True},'assets':assets},'scope':scope}
(base/'hr-department-input-release-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
frozen_changes=changed&set(manifest)
assert all(p in primary or p.startswith(str(base)+'/') for p in frozen_changes)
audit=['integrate-hr-department-input.py','hr-department-input-current-gate.txt','hr-department-input-repair-plan.json','hr-department-input-gate-preparation.json','hr-department-input-baseline.json','verify-hr-department-input-baseline.cjs','hr-department-concurrent-cycle-baseline.json','hr-department-concurrency-postgres-baseline.json','hr-department-input-next-results.json','hr-department-input-next-supervisor.json','hr-department-input-postgres.json','hr-department-input-postgres-supervisor.json','hr-department-input-overlay-typecheck.json','hr-department-input-legacy-related.json','hr-department-input-legacy-access.json','hr-department-input-legacy-validation.json','hr-department-input-legacy-cache.json','prepare-hr-department-input-release.py','publish-hr-department-input.py','hr-department-input-release-observe.py','verify-hr-department-input-public.py','hr-department-input-release-review.json','hr-department-input-release-allowlist.json','hr-org-chart-pagination-release-tracking.json','hr-org-chart-pagination-public.json','hr-org-chart-pagination-repair-plan.json','hr-org-chart-pagination-public-verifier-failure.json','verify-hr-org-chart-pagination-public.py']
files=sorted(set(primary)|frozen_changes|{str(base/n) for n in audit}|{str(gate/n) for n in ['supervise.py','state.json','source-manifest.json']})
allow={'checkedAt':review['checkedAt'],'releaseReady':True,'files':files,'requiredPrimaryFiles':primary,'reports':[['hr-department-input-next-results.json',53]],'scope':scope}
(base/'hr-department-input-release-allowlist.json').write_text(json.dumps(allow,ensure_ascii=False,indent=2)+'\n')
assert all(pathlib.Path(p).is_file() for p in files)
print(json.dumps({'readyForExactPublish':True,'files':len(files),'productionFiles':4,'fullGate':163,'actualNext':53}))
