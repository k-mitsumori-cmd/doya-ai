import pathlib, json, hashlib, subprocess, datetime

root = pathlib.Path.cwd()
base = pathlib.Path('docs/audits/2026-10-06-all-services-recheck')
overlay = base / 'hr-org-chart-pagination-repair-overlay'
prior = json.loads((base / 'hr-kintai-additional-cache-release-tracking.json').read_text())
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert prior['commit'] == head and prior['observerStatus'] == 'passed'
assert prior['ci']['conclusion'] == 'success' and prior['deployment']['readyState'] == 'READY'
assert prior['publicVerificationExitCode'] == 0
assert not subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], text=True).strip()
files = ['src/app/api/hr/org-chart/route.ts', 'src/app/hr/org-chart/page.tsx', 'src/components/hr/OrgChartView.tsx', 'src/lib/hr/org-chart-pagination.ts', 'src/lib/hr/org-chart-paged-client.ts']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for name, count in [('postgres', 18), ('boundaries-overlay', 28), ('mounted-overlay', 14), ('native-overlay', 10), ('legacy-overlay', 11)]:
    proof = json.loads((base / ('hr-org-chart-pagination-' + name + '.json')).read_text())
    assert proof['expected'] == count and proof['passed'] == count and len(proof['cases']) == count, name
    assert proof['sourceHashes'], name
    for source, digest in proof['sourceHashes'].items():
        candidate = pathlib.Path(source)
        if not candidate.is_absolute() and (overlay / source).is_file(): candidate = overlay / source
        assert sha(candidate) == digest, (name, source)
types = json.loads((base / 'hr-org-chart-pagination-overlay-typecheck.json').read_text())
assert types['passed'] and not types['errors']
assert all(sha(pathlib.Path(p)) == h for p, h in types['sourceHashes'].items())
pg = json.loads((base / 'hr-org-chart-pagination-postgres-supervisor.json').read_text())
assert pg['status'] == 'passed' and pg['evidenceValid'] and pg['stopExitCode'] == 0 and pg['postStopStatusExitCode'] == 3 and pg['privateFolderRemoved']
assert (overlay / 'src/app/api/kintai/departments/route.ts').read_bytes() == pathlib.Path('src/app/api/kintai/departments/route.ts').read_bytes()

prepared = {}
stub = "'@/lib/hr/org-chart-pagination': { readHrOrgChartPage() { throw Error('Legacy fixture unexpectedly entered paged GET') }, HrOrgChartPageError: class extends Error {} }, "
for name, marker in [('verify-org-chart-kintai-private-cache.cjs', "const mocks={"), ('verify-hr-employee-reads.cjs', "const next = { ")]:
    p = pathlib.Path('scripts/security-regression') / name
    source = p.read_text()
    assert source.count(marker) == 1 and '@/lib/hr/org-chart-pagination' not in source
    prepared[str(p)] = source.replace(marker, marker + stub, 1)

# Keep all four original authorized-employee visibility cases and make every
# reported defect fatal in the mandatory root suite.
source = (base / 'verify-hr-org-chart-visibility-followup.cjs').read_text()
source = source.replace("require('../../../scripts/security-regression/load-typescript.cjs')", "require('./load-typescript.cjs')")
marker = "'next/server': { NextResponse: Response },"
assert source.count(marker) == 1
source = source.replace(marker, stub + marker, 1)
start = source.index('  fs.writeFileSync(')
end = source.index('  console.log(', start)
source = source[:start] + "  assert.equal(report.passed, 4);\n" + source[end:]
prepared['scripts/security-regression/verify-hr-org-chart-visibility.cjs'] = source

# Retain all28 protocol/safety/large-chart cases against root, with no overlay
# fallback and no audit-report writes during CI.
source = (base / 'verify-hr-org-chart-pagination-boundaries.cjs').read_text()
source = source.replace("require('../../../scripts/security-regression/load-typescript.cjs')", "require('./load-typescript.cjs')")
source = source.replace("process.env.DOYA_TEST_BASELINE ||= base+'hr-org-chart-pagination-repair-overlay';\n", "assert.ok(!process.env.DOYA_TEST_BASELINE, 'Mandatory paged-client tests must use root');\n")
start = source.index(' assert.equal(cases.length,28);')
source = source[:start] + " assert.equal(cases.length,28);assert.equal(cases.filter(c=>c.passed).length,28);console.log(JSON.stringify({expected:28,passed:28,cases}));\n})().catch(e=>{console.error(e);process.exitCode=1});\n"
prepared['scripts/security-regression/verify-hr-org-chart-paged-client.cjs'] = source
runner = pathlib.Path('scripts/security-regression/run.cjs')
prepared[str(runner)] = "for (const file of ['verify-hr-org-chart-visibility.cjs', 'verify-hr-org-chart-paged-client.cjs']) { const r = require('node:child_process').spawnSync(process.execPath, [require('node:path').join(__dirname, file)], {stdio:'inherit',timeout:60000}); if(r.error || r.status!==0) process.exit(r.status || 1); }\n" + runner.read_text()

for name in files: pathlib.Path(name).write_bytes((overlay / name).read_bytes())
for name, source in prepared.items(): pathlib.Path(name).write_text(source)
plan = json.loads((base / 'hr-org-chart-pagination-repair-plan.json').read_text())
plan.update(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='root-integrated-awaiting-frozen-full-gate-and-actualNext35', rootApplied=True, deployed=False, productionFiles=files, regressionFiles=sorted(prepared), previousVerifiedCommit=head)
plan['verification'].update(isolatedPostgresCases=18, boundaryCases=28, legacyCases=11, all10001EnterpriseEmployeesExactlyOnce=True, valid1500LevelHierarchy=True, mvccDirectSqlEditDetected=True)
plan['pending'] = ['Mandatory root regression and fresh frozen original150 plus added gates', 'Actual Next/auth/realDB35 including original25 legacy reads and10 paged cases', 'Exact reviewed commit/push, CI, production READY and public verification', 'Continue full17service2074criterion188GET audit; department concurrency repair remains separate']
(base / 'hr-org-chart-pagination-repair-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'rootApplied':True,'productionFiles':files,'regressionFiles':sorted(prepared),'head':head}))
