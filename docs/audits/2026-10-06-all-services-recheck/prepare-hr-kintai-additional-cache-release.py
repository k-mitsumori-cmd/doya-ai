import pathlib,json,hashlib,datetime,subprocess
base=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd().resolve())
gate=pathlib.Path((base/'hr-kintai-additional-cache-current-gate.txt').read_text().strip())
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==150 and all(x['exitCode']==0 for x in state['gates']) and not state['changedSources']
manifest=json.loads((gate/'source-manifest.json').read_text())
assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in manifest.items())
next_report=json.loads((base/'hr-kintai-additional-cache-next-results.json').read_text())
assert next_report['expected']==20 and next_report['passed']==20 and len(next_report['cases'])==20 and next_report['checkedAt']>=state['startedAt']
assert len(next_report['sourceHashes'])==10 and all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in next_report['sourceHashes'].items())
supervisor=json.loads((base/'hr-kintai-additional-cache-next-supervisor.json').read_text())
assert supervisor['status']=='passed' and supervisor['evidenceValid'] and supervisor['stopExitCode']==0 and supervisor['postStopStatusExitCode']==3 and supervisor['privateFolderRemoved'] and supervisor['startedAt']>=state['startedAt']
production=['src/app/api/hr/departments/route.ts','src/app/api/hr/org-chart/route.ts','src/app/api/kintai/departments/route.ts']
regression=['scripts/security-regression/verify-related-records.cjs','scripts/security-regression/run.cjs','scripts/security-regression/verify-hr-department-access.cjs','scripts/security-regression/verify-hr-department-private-cache.cjs','scripts/security-regression/verify-kintai-department-mutation-atomic.cjs','scripts/security-regression/verify-org-chart-kintai-private-cache.cjs']
primary=production+regression
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
rootChanges=set(git('diff','--name-only','HEAD','--','src','scripts','reference').splitlines())|set(git('ls-files','--others','--exclude-standard','--','src','scripts','reference').splitlines())
assert rootChanges==set(primary),(rootChanges-set(primary),set(primary)-rootChanges)
for name in ['prisma/schema.prisma','package.json','package-lock.json']:
 assert pathlib.Path(name).read_bytes()==subprocess.check_output(['git','show','HEAD:'+name]),name
# GET-only cache change: normalize wrappers to prove all read queries and POST bodies unchanged.
for name in production:
 original=subprocess.check_output(['git','show','HEAD:'+name],text=True);candidate=pathlib.Path(name).read_text()
 def normalize(text):return text.replace("import { privateApiJson } from '@/lib/private-api-response'\n",'').replace("import { NextResponse } from 'next/server'\n",'').replace('privateApiJson(', 'NextResponse.json(')
 assert normalize(original)==normalize(candidate),name
 if 'export async function POST' in original:assert original.split('export async function POST',1)[1]==candidate.split('export async function POST',1)[1],name
entries=[];assets={}
for name in ['hr/departments','hr/org-chart','kintai/departments']:
 p=pathlib.Path('.next/server/app/api')/name/'route.js';assert p.is_file()
 text=p.read_text();assert 'private, no-store' in text and 'Cookie' in text,str(p)
 h=hashlib.sha256(p.read_bytes()).hexdigest();entries.append({'route':'/api/'+name,'file':str(p),'hash':h});assets[str(p)]=h
scope='Three organization-scoped GET cache policies only; POST bodies and original queries/auth unchanged. Full150 plus actual Next20 synthetic two-organization/read-only/role/revoked-session verification. No production/customer writes, schema/dependency changes or paid generation. Full17-service2074 audit remains active.'
review={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gate':str(gate),'reviewStatus':'full150-and-actualNext20-passed-awaiting-exact-publish','productionFiles':production,'regressionFiles':regression,'requiredPrimaryFiles':primary,'sourceHashes':{p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in primary},'compiledMarkerProof':{'checks':{'full150':True,'frozenSourcesUnchanged':True,'actualNext20':True,'isolatedDatabaseStoppedAndRemoved':True,'threeBuiltApiEntries':len(entries)==3,'getOnlyPolicyChange':True},'apiEntries':entries,'assets':assets},'scope':scope}
(base/'hr-kintai-additional-cache-release-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
audit=['resume-hr-kintai-additional-cache-gate.py','hr-kintai-additional-cache-gate-repair.json','integrate-hr-kintai-additional-cache.py','hr-kintai-additional-cache-current-gate.txt','hr-kintai-additional-cache-repair-plan.json','verify-hr-kintai-additional-cache-next.cjs','hr-kintai-additional-cache-next-supervise.py','hr-kintai-additional-cache-next-supervisor.json','hr-kintai-additional-cache-next-results.json','hr-kintai-additional-cache-after-gate.py','hr-kintai-additional-cache-after-gate.json','prepare-hr-kintai-additional-cache-release.py','publish-hr-kintai-additional-cache.py','hr-kintai-additional-cache-release-observe.py','verify-hr-kintai-additional-cache-public.py','hr-kintai-additional-cache-release-review.json','hr-kintai-additional-cache-release-allowlist.json','verify-seo-durable-public.py','seo-durable-public-header-diagnostic.json','seo-durable-public.json','seo-durable-release-tracking.json']
files=sorted(set(primary+[str(base/n) for n in audit]+[str(gate/n) for n in ['supervise.py','state.json','source-manifest.json','before-frozen-pointer-repair/state.json','before-frozen-pointer-repair/supervise.py','before-frozen-pointer-repair/doyalist-next.log','before-frozen-pointer-repair/resume-controller-setup-attempt.json']]))
allow={'checkedAt':review['checkedAt'],'releaseReady':True,'files':files,'requiredPrimaryFiles':primary,'reports':[['hr-kintai-additional-cache-next-results.json',20]],'scope':scope}
(base/'hr-kintai-additional-cache-release-allowlist.json').write_text(json.dumps(allow,ensure_ascii=False,indent=2)+'\n')
assert all(pathlib.Path(p).is_file() for p in files)
print(json.dumps({'readyForExactPublish':True,'files':len(files),'productionFiles':3,'fullGate':150,'actualNext':20}))
