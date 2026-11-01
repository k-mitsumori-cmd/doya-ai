import pathlib, json, hashlib, subprocess, datetime, uuid, ast

root = pathlib.Path.cwd()
base = pathlib.Path('docs/audits/2026-10-06-all-services-recheck')
overlay = base / 'hr-department-input-repair-overlay'
prior = json.loads((base / 'hr-org-chart-pagination-release-tracking.json').read_text())
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert prior['commit'] == head and prior.get('observerStatus') == 'passed', 'Wait for exact org-chart public verification'
assert prior['ci']['conclusion'] == 'success' and prior['deployment']['readyState'] == 'READY' and prior['publicVerificationExitCode'] == 0
public = json.loads((base / 'hr-org-chart-pagination-public.json').read_text())
assert public['passed'] and public['commit'] == head and public['deployment'] == prior['deployment']['id']
assert not subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], text=True).strip()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
proof = json.loads((base / 'hr-department-input-postgres.json').read_text())
assert proof['expected'] == 47 and proof['passed'] == 47 and len(proof['cases']) == 47
assert len(proof['sourceHashes']) == 11
for name, digest in proof['sourceHashes'].items():
    candidate = overlay / name if (overlay / name).is_file() else pathlib.Path(name)
    assert sha(candidate) == digest, name
supervisor = json.loads((base / 'hr-department-input-postgres-supervisor.json').read_text())
assert supervisor['status'] == 'passed' and supervisor['evidenceValid'] and supervisor['stopExitCode'] == 0 and supervisor['postStopStatusExitCode'] == 3 and supervisor['privateFolderRemoved']
for mode, count in [('related', 33), ('access', 1), ('validation', 6), ('cache', 3)]:
    report = json.loads((base / ('hr-department-input-legacy-' + mode + '.json')).read_text())
    assert report['expected'] == count and report['passed'] == count and len(report['cases']) == count
    assert all(sha(pathlib.Path(p)) == h for p, h in report['sourceHashes'].items())
types = json.loads((base / 'hr-department-input-overlay-typecheck.json').read_text())
assert types['passed'] and not types['errors'] and types['expectedOverlayFiles'] == 4
assert all(sha(pathlib.Path(p)) == h for p, h in types['sourceHashes'].items())
production = ['src/lib/hr/department-input.ts', 'src/lib/hr/department-mutation.ts', 'src/app/api/hr/departments/route.ts', 'src/app/api/hr/departments/[id]/route.ts']
regression = ['scripts/security-regression/' + name for name in ['verify-related-records.cjs', 'verify-hr-department-access.cjs', 'verify-hr-department-input.cjs', 'verify-hr-department-private-cache.cjs']]
prepared = {name: (base / 'hr-department-input-regression-overlay' / name).read_bytes() for name in regression}
runner = pathlib.Path('scripts/security-regression/run.cjs')
prepared[str(runner)] = ("for (const file of ['verify-hr-department-input.cjs']) { const r = require('node:child_process').spawnSync(process.execPath, [require('node:path').join(__dirname, file)], {stdio:'inherit',timeout:60000}); if(r.error || r.status!==0) process.exit(r.status || 1); }\n" + runner.read_text()).encode()

old_gate = pathlib.Path((base / 'hr-org-chart-pagination-current-gate.txt').read_text().strip())
source = (old_gate / 'supervise.py').read_text()
tree = ast.parse(source)
loop = next(n for n in tree.body if isinstance(n, ast.For) and ast.unparse(n.target) == '(name, args)')
old_steps = ast.literal_eval(loop.iter)
assert len(old_steps) == 156
steps = [('hr-department-input-realPG47', ['python3', str(base / 'hr-department-input-postgres-supervise.py')])]
steps += [('hr-department-input-legacy-' + mode, ['node', str(base / 'verify-hr-department-input-legacy.cjs'), mode]) for mode in ['related', 'access', 'validation', 'cache']]
steps += [('hr-department-input-types4', ['node', str(base / 'verify-hr-department-input-overlay-types.cjs')]), ('hr-department-input-actualNext53', ['python3', str(base / 'hr-department-input-next-supervise.py')])]
assert len(old_steps + steps) == 163
lines = source.splitlines(keepends=True)
source = ''.join(lines[:loop.lineno - 1]) + 'for name,args in ' + repr(old_steps + steps) + ':\n' + ''.join(lines[loop.lineno:])
source = source.replace("len(state['gates'])==156", "len(state['gates'])==163")
old_pointer = str(base / 'hr-org-chart-pagination-current-gate.txt')
new_pointer = str(base / 'hr-department-input-current-gate.txt')
assert old_pointer in source
source = source.replace(old_pointer, new_pointer)
assert old_pointer not in source and str(base / 'seo-durable-current-gate.txt') not in source
additional = ['verify-hr-department-input-postgres.cjs', 'hr-department-input-postgres-supervise.py', 'verify-hr-department-input-legacy.cjs', 'verify-hr-department-input-overlay-types.cjs', 'verify-hr-department-input-next.cjs', 'hr-department-input-next-supervise.py']
source = source.replace(' files=set()\n', ' files=set()\n files.update(pathlib.Path(' + repr(str(base)) + ')/name for name in ' + repr(additional) + ')\n files.update(x for x in pathlib.Path(' + repr(str(overlay)) + ').rglob("*") if x.is_file())\n files.update(x for x in pathlib.Path(' + repr(str(base / 'hr-department-input-regression-overlay')) + ').rglob("*") if x.is_file())\n', 1)
ast.parse(source)

for name in production: pathlib.Path(name).write_bytes((overlay / name).read_bytes())
for name, data in prepared.items(): pathlib.Path(name).write_bytes(data)
gate = base / ('hr-department-input-release-' + str(uuid.uuid4()))
gate.mkdir()
(gate / 'supervise.py').write_text(source)
(base / 'hr-department-input-current-gate.txt').write_text(str(gate) + '\n')
plan = json.loads((base / 'hr-department-input-repair-plan.json').read_text())
plan.update(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='root-integrated-awaiting-fresh-full163-and-actualNext53', rootApplied=True, deployed=False, previousVerifiedCommit=head, regressionFiles=sorted(prepared), currentGate=str(gate))
(base / 'hr-department-input-repair-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
(base / 'hr-department-input-gate-preparation.json').write_text(json.dumps({'previousGate':str(old_gate),'previousCount':156,'newGate':str(gate),'newCount':163,'allOriginal156RetainedInOrder':True,'added':steps,'pointerCorrectedBeforeStart':True}, indent=2) + '\n')
print(json.dumps({'rootApplied':True,'productionFiles':production,'regressionFiles':sorted(prepared),'gate':str(gate),'expected':163,'actualNext':53}))
