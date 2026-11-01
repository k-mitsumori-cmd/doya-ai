import pathlib,json,hashlib,datetime,subprocess
base=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd().resolve())
gate=pathlib.Path((base/'seo-durable-current-gate.txt').read_text().strip())
state=json.loads((gate/'state.json').read_text())
repair=json.loads((base/'seo-cancel-budget-repair-plan.json').read_text())
assert repair.get('rootApplied') is True and repair.get('status')=='integrated-and-verified', 'Cancellation capacity repair pending; do not publish earlier unlimited-write candidate'
assert state['status']=='passed' and len(state['gates'])==150 and all(x['exitCode']==0 for x in state['gates']) and not state['changedSources']
manifest=json.loads((gate/'source-manifest.json').read_text())
assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in manifest.items())
reports=[['seo-creation-receipt-integrated.json',23],['seo-creation-recovery-api-integrated.json',11],['seo-creation-post-route-integrated.json',10],['seo-template-durable-mounted-integrated.json',51],['seo-template-durable-native-integrated.json',15],['seo-creation-receipt-postgres-results.json',13],['seo-durable-next-results.json',19]]
for name,count in reports:
 d=json.loads((base/name).read_text());assert d['passed']==count and len(d['cases'])==count and d.get('expected',count)==count and d['checkedAt']>=state['startedAt'],name
 hashes=d.get('sourceHashes') or {d['source']:d['sourceHash']}
 assert all(pathlib.Path(p).is_file() and hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items()),name
for name in ['seo-creation-receipt-integrated-postgres-supervisor.json','seo-durable-next-supervisor.json']:
 d=json.loads((base/name).read_text());assert d['status']=='passed' and d['evidenceValid'] and d['stopExitCode']==0 and d['postStopStatusExitCode']==3 and d['privateFolderRemoved'] and d['startedAt']>=state['startedAt'],name
production=['src/lib/seo-article-admission.ts','src/lib/use-seo-creation-recovery.ts','src/app/api/seo/articles/route.ts','src/app/api/seo/article-operation/route.ts','src/app/seo/template/page.tsx']
regression=['scripts/security-regression/run.cjs','scripts/security-regression/verify-seo-create-route-admission.cjs','scripts/security-regression/verify-seo-template-actor-mounted.cjs','scripts/security-regression/verify-seo-creation-receipt.cjs','scripts/security-regression/verify-seo-creation-recovery-api.cjs']
primary=production+regression+['reference/services/seo.md','reference/11-billing-spec.md']
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
rootChanges=set(git('diff','--name-only','HEAD','--','src','scripts','reference').splitlines())|set(git('ls-files','--others','--exclude-standard','--','src','scripts','reference').splitlines())
assert rootChanges==set(primary),(rootChanges-set(primary),set(primary)-rootChanges)
for name in ['prisma/schema.prisma','package.json','package-lock.json']:
 assert pathlib.Path(name).read_bytes()==subprocess.check_output(['git','show','HEAD:'+name]),name
entries=[];assets={}
for name in ['seo/articles','seo/article-operation']:
 p=pathlib.Path('.next/server/app/api')/name/'route.js';assert p.is_file();h=hashlib.sha256(p.read_bytes()).hexdigest();entries.append({'route':'/api/'+name,'file':str(p),'hash':h});assets[str(p)]=h
server=[]
# Next can inline the shared admission module in each route instead of emitting a shared chunk.
# Require all recovery/capacity markers in both actual compiled API entries.
for entry in entries:
 p=pathlib.Path(entry['file']);text=p.read_text()
 assert all(marker in text for marker in ['seo-article-create:v1:','seo-article-cancel-budget:v1:','cancelled']), str(p)
 server.append(str(p));assets[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
assert len(server)==2,'Both compiled SEO API receipt/cancellation helpers required'
client=[]
for p in pathlib.Path('.next/static/chunks/app/seo/template').glob('page-*.js'):
 text=p.read_text()
 if all(x in text for x in ['seo-article-create-intent:v1:','/api/seo/article-operation?operationId=','作成結果を確認','未受付の操作を終了']):client.append(str(p));assets[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
assert client,'Compiled template recovery client missing'
review={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gate':str(gate),'reviewStatus':'full150-and-actualNext19-passed-awaiting-exact-publish','productionFiles':production,'regressionFiles':regression,'requiredPrimaryFiles':primary,'sourceHashes':{p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in primary},'compiledMarkerProof':{'checks':{'full150':True,'frozenSourcesUnchanged':True,'actualNext19':True,'isolatedDatabasesStoppedAndRemoved':True,'twoBuiltApiEntries':len(entries)==2,'durableReceiptServer':bool(server),'durableRecoveryClient':bool(client)},'apiEntries':entries,'assets':assets,'serverMarkerAssets':server,'clientMarkerAssets':client},'scope':'SEO durable creation/recovery and downgrade only. Original monthly quota/legacy APIs, schema and dependencies preserved; original28 mounted cases retained in51. Native15, real transaction13 and actual Next19 required. No production/customer data writes or paid provider generation. Full17-service2074 audit remains active.'}
(base/'seo-durable-release-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
audit=['seo-cancel-budget-repair-plan.json','verify-seo-template-actor-native.cjs','verify-seo-creation-receipt-postgres.cjs','seo-creation-receipt-integrated-postgres-supervise.py','seo-creation-receipt-integrated-postgres-supervisor.json','verify-seo-durable-next.cjs','seo-durable-next-supervise.py','seo-durable-next-supervisor.json','seo-durable-next-after-gate.py','seo-durable-integration-review.json','seo-durable-current-gate.txt','prepare-seo-durable-release.py','publish-seo-durable.py','seo-durable-release-observe.py','verify-seo-durable-public.py','seo-durable-release-review.json','seo-durable-release-allowlist.json']+[n for n,c in reports]
files=sorted(set(primary+[str(base/n) for n in audit]+[str(gate/n) for n in ['supervise.py','state.json','source-manifest.json']]))
allow={'checkedAt':review['checkedAt'],'releaseReady':True,'files':files,'requiredPrimaryFiles':primary,'reports':reports,'scope':review['scope']}
(base/'seo-durable-release-allowlist.json').write_text(json.dumps(allow,ensure_ascii=False,indent=2)+'\n')
assert all(pathlib.Path(p).is_file() for p in files)
print(json.dumps({'readyForExactPublish':True,'files':len(files),'productionFiles':len(production),'fullGate':150,'actualNext':19}))
