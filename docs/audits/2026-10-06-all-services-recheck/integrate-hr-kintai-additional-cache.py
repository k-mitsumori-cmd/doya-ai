import pathlib, json, subprocess, datetime, uuid

base = pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd().resolve())
previous = json.loads((base / 'seo-durable-release-tracking.json').read_text())
assert previous.get('observerStatus') == 'passed' and previous['ci']['conclusion'] == 'success' and previous['deployment']['readyState'] == 'READY' and previous['publicVerificationExitCode'] == 0, 'Wait for exact SEO production verification'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert head == previous['commit']
assert not subprocess.check_output(['git', 'diff', '--name-only', 'HEAD', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard', '--', 'src', 'scripts', 'reference'], text=True).strip()
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], text=True).strip()
overlay = base / 'hr-kintai-additional-cache-repair-overlay'
files = ['src/app/api/hr/departments/route.ts', 'src/app/api/hr/org-chart/route.ts', 'src/app/api/kintai/departments/route.ts']
def normalize(source):
    return source.replace("import { privateApiJson } from '@/lib/private-api-response'\n", '').replace("import { NextResponse } from 'next/server'\n", '').replace('privateApiJson(', 'NextResponse.json(')
for name in files:
    original = pathlib.Path(name).read_text()
    candidate = (overlay / name).read_text()
    assert normalize(original) == normalize(candidate), name
    if 'export async function POST' in original:
        assert original.split('export async function POST', 1)[1] == candidate.split('export async function POST', 1)[1], name

regressions = [
    ('verify-hr-department-cache-followup.cjs', 'verify-hr-department-private-cache.cjs'),
    ('verify-org-chart-kintai-department-cache-followup.cjs', 'verify-org-chart-kintai-private-cache.cjs'),
]
prepared = {}
for source, target in regressions:
    text = (base / source).read_text().replace("require('../../../scripts/security-regression/load-typescript.cjs')", "require('./load-typescript.cjs')")
    start = text.index('fs.writeFileSync(')
    end = text.index(';console.log(', start)
    text = text[:start] + text[end + 1:]
    if source == 'verify-hr-department-cache-followup.cjs':
        old = "privateNoStore:cache.split(',').some(v=>v.trim().toLowerCase()==='no-store')&&"
        new = "privateNoStore:cache.split(',').some(v=>v.trim().toLowerCase()==='private')&&cache.split(',').some(v=>v.trim().toLowerCase()==='no-store')&&"
        assert old in text
        text = text.replace(old, new).replace('Follow-up cohort; selected source may be overlay; no production repair applied.', 'Root mandatory regression; local source behavior only, not production deployment proof.')
    prepared['scripts/security-regression/' + target] = text
for name in ['verify-hr-department-access.cjs', 'verify-kintai-department-mutation-atomic.cjs']:
    p = pathlib.Path('scripts/security-regression') / name
    text = p.read_text()
    assert "'@/lib/private-api-response'" not in text
    text = "const privateApiResponse = require('./load-typescript.cjs').load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });\n" + text
    assert "'next/server': { NextResponse: Response }," in text
    prepared[str(p)] = text.replace("'next/server': { NextResponse: Response },", "'@/lib/private-api-response': privateApiResponse,\n    'next/server': { NextResponse: Response },")
related = pathlib.Path('scripts/security-regression/verify-related-records.cjs')
text = related.read_text()
assert "'@/lib/private-api-response'" not in text
text = text.replace("const Resp={json:", "const privateApiResponse=require('./load-typescript.cjs').load('src/lib/private-api-response.ts',{'next/server':{NextResponse:Response}});\nconst Resp={json:")
needle = "const mocks={...auth,'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma},'@/lib/department-integrity':helper"
assert text.count(needle) == 1
prepared[str(related)] = text.replace(needle, "const mocks={...auth,'@/lib/private-api-response':privateApiResponse,'next/server':{NextResponse:Resp},'@/lib/prisma':{prisma},'@/lib/department-integrity':helper")
runner = pathlib.Path('scripts/security-regression/run.cjs')
prepared[str(runner)] = "for (const file of ['verify-hr-department-private-cache.cjs', 'verify-org-chart-kintai-private-cache.cjs']) { const r = require('node:child_process').spawnSync(process.execPath, [require('node:path').join(__dirname, file)], {stdio:'inherit',timeout:60000}); if(r.error || r.status!==0) process.exit(r.status || 1); }\n" + runner.read_text()

# Prepare everything before applying; the verified cohort changes only these three GET policies.
for name in files:
    pathlib.Path(name).write_bytes((overlay / name).read_bytes())
for name, text in prepared.items():
    pathlib.Path(name).write_text(text)
plan = json.loads((base / 'hr-kintai-additional-cache-repair-plan.json').read_text())
plan.update(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='integrated-awaiting-full150-and-actualNext20', rootApplied=True, deployed=False, productionFiles=files, regressionFiles=sorted(prepared), previousVerifiedCommit=head)
(base / 'hr-kintai-additional-cache-repair-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
old_gate = pathlib.Path((base / 'seo-durable-current-gate.txt').read_text().strip())
gate = base / ('hr-kintai-additional-cache-release-' + str(uuid.uuid4()))
gate.mkdir()
supervisor = (old_gate / 'supervise.py').read_text().replace("seo-durable-current-gate.txt", "hr-kintai-additional-cache-current-gate.txt")
marker = ' files=set()\n'
assert marker in supervisor
supervisor = supervisor.replace(marker, marker + " files.update(pathlib.Path('docs/audits/2026-10-06-all-services-recheck')/name for name in ['verify-hr-kintai-additional-cache-next.cjs','hr-kintai-additional-cache-next-supervise.py'])\n", 1)
(gate / 'supervise.py').write_text(supervisor)
(base / 'hr-kintai-additional-cache-current-gate.txt').write_text(str(gate) + '\n')
print(json.dumps({'integrated': True, 'productionFiles': files, 'regressionFiles': sorted(prepared), 'nextGate': str(gate), 'fullGate': 150, 'actualNext': 20}))
