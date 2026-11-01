import pathlib, json, hashlib, datetime, subprocess

base = pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd().resolve())
gate = pathlib.Path((base / 'hr-org-chart-pagination-current-gate.txt').read_text().strip())
findings = base / 'hr-org-chart-pagination-additional-findings.json'
assert not findings.exists() or json.loads(findings.read_text()).get('status') == 'resolved-and-verified', 'Independent long-field compatibility defect remains unresolved; do not release'
state = json.loads((gate / 'state.json').read_text())
assert state['status'] == 'passed' and len(state['gates']) == 156 and all(x['exitCode'] == 0 for x in state['gates']) and not state['changedSources']
manifest = json.loads((gate / 'source-manifest.json').read_text())
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert all(pathlib.Path(p).is_file() and sha(p) == h for p, h in manifest.items())
report = json.loads((base / 'hr-org-chart-pagination-next-results.json').read_text())
assert report['expected'] == 38 and report['passed'] == 38 and len(report['cases']) == 38 and report['checkedAt'] >= state['startedAt']
assert len(report['sourceHashes']) == 14 and all(sha(p) == h for p, h in report['sourceHashes'].items())
supervisor = json.loads((base / 'hr-org-chart-pagination-next-supervisor.json').read_text())
assert supervisor['status'] == 'passed' and supervisor['evidenceValid'] and supervisor['stopExitCode'] == 0 and supervisor['postStopStatusExitCode'] == 3 and supervisor['privateFolderRemoved'] and supervisor['startedAt'] >= state['startedAt']
production = ['src/app/api/hr/org-chart/route.ts', 'src/app/hr/org-chart/page.tsx', 'src/components/hr/OrgChartView.tsx', 'src/lib/hr/org-chart-pagination.ts', 'src/lib/hr/org-chart-paged-client.ts']
regression = ['scripts/security-regression/run.cjs', 'scripts/security-regression/verify-hr-employee-reads.cjs', 'scripts/security-regression/verify-org-chart-kintai-private-cache.cjs', 'scripts/security-regression/verify-hr-org-chart-paged-client.cjs', 'scripts/security-regression/verify-hr-org-chart-visibility.cjs']
primary = production + regression
def git(*args): return subprocess.check_output(['git', *args], text=True).strip()
changed = set(git('diff', '--name-only', 'HEAD').splitlines()) | set(git('ls-files', '--others', '--exclude-standard').splitlines())
root_changes = {p for p in changed if p.startswith(('src/', 'scripts/', 'reference/'))}
assert root_changes == set(primary), (root_changes - set(primary), set(primary) - root_changes)
for name in ['prisma/schema.prisma', 'package.json', 'package-lock.json']:
    assert pathlib.Path(name).read_bytes() == subprocess.check_output(['git', 'show', 'HEAD:' + name]), name
for name in production:
    assert pathlib.Path(name).read_bytes() == (base / 'hr-org-chart-pagination-repair-overlay' / name).read_bytes(), name

entry = pathlib.Path('.next/server/app/api/hr/org-chart/route.js')
assert entry.is_file()
assets = {str(entry): sha(entry)}
helper_entries = [p for p in pathlib.Path('.next/server').rglob('*.js') if 'hr-org-chart-page-v1' in p.read_text()]
assert helper_entries, 'Built server pagination protocol is missing'
assets.update({str(p): sha(p) for p in helper_entries})
client_manifest = json.loads(pathlib.Path('.next/app-build-manifest.json').read_text())
page_chunks = client_manifest['pages']['/hr/org-chart/page']
assert page_chunks
client_text = '\n'.join((pathlib.Path('.next') / p).read_text() for p in page_chunks)
markers = ['/api/hr/org-chart?format=pages', 'hr-org-chart-page-v1', 'さらに', '取得中に組織図が更新されました']
assert all(value in client_text for value in markers), 'Built page protocol/recovery markers are missing'
assets.update({str(pathlib.Path('.next') / p): sha(pathlib.Path('.next') / p) for p in page_chunks})
scope = 'HR org-chart pagination, authorized employee visibility, revision consistency and client recovery. Five production files, five mandatory regression files. Original150 frozen checks preserved plus6, actual Next/auth/isolatedDB38, realPG18, boundary31, mounted14, native10. No schema/dependency/customer DB changes, real OAuth or paid providers. Full17services2074criteria188GET audit remains active.'
review = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'gate': str(gate), 'reviewStatus': 'full156-and-actualNext38-passed-awaiting-exact-publish', 'productionFiles': production, 'regressionFiles': regression, 'requiredPrimaryFiles': primary, 'sourceHashes': {p: sha(p) for p in primary}, 'compiledMarkerProof': {'checks': {'full156': True, 'original150Preserved': True, 'frozenSourcesUnchanged': True, 'actualNext38': True, 'isolatedDatabaseStoppedAndRemoved': True, 'serverProtocolBuilt': True, 'pageProtocolRecoveryBuilt': True}, 'assets': assets}, 'scope': scope}
(base / 'hr-org-chart-pagination-release-review.json').write_text(json.dumps(review, ensure_ascii=False, indent=2) + '\n')

frozen_changes = changed & set(manifest)
assert all(p in primary or p.startswith(str(base) + '/') for p in frozen_changes), 'Unexpected frozen source change'
audit = ['hr-org-chart-pagination-additional-findings.json', 'hr-org-chart-long-text-baseline.json', 'verify-hr-org-chart-long-text-baseline.cjs', 'hr-org-chart-pagination-gate-repair.json', 'integrate-hr-org-chart-pagination.py', 'hr-org-chart-pagination-current-gate.txt', 'hr-org-chart-pagination-repair-plan.json', 'hr-org-chart-pagination-gate-preparation.json', 'hr-org-chart-pagination-next-results.json', 'hr-org-chart-pagination-next-supervisor.json', 'hr-org-chart-pagination-postgres.json', 'hr-org-chart-pagination-postgres-supervisor.json', 'hr-org-chart-pagination-boundaries-overlay.json', 'hr-org-chart-pagination-legacy-overlay.json', 'hr-org-chart-pagination-mounted-overlay.json', 'hr-org-chart-pagination-native-overlay.json', 'hr-org-chart-pagination-overlay-typecheck.json', 'verify-hr-org-chart-pagination-overlay-types.cjs', 'prepare-hr-org-chart-pagination-release.py', 'publish-hr-org-chart-pagination.py', 'hr-org-chart-pagination-release-observe.py', 'verify-hr-org-chart-pagination-public.py', 'hr-org-chart-pagination-release-review.json', 'hr-org-chart-pagination-release-allowlist.json', 'hr-kintai-additional-cache-release-tracking.json', 'hr-kintai-additional-cache-public.json', 'hr-kintai-additional-cache-repair-plan.json']
files = sorted(set(primary) | frozen_changes | {str(base / name) for name in audit} | {str(gate / name) for name in ['supervise.py', 'state.json', 'source-manifest.json']})
allow = {'checkedAt': review['checkedAt'], 'releaseReady': True, 'files': files, 'requiredPrimaryFiles': primary, 'reports': [['hr-org-chart-pagination-next-results.json', 38]], 'scope': scope}
(base / 'hr-org-chart-pagination-release-allowlist.json').write_text(json.dumps(allow, ensure_ascii=False, indent=2) + '\n')
assert all(pathlib.Path(p).is_file() for p in files)
print(json.dumps({'readyForExactPublish': True, 'files': len(files), 'productionFiles': 5, 'fullGate': 156, 'actualNext': 38}))
