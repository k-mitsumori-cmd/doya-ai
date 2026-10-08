import pathlib,json,hashlib,datetime
base=pathlib.Path(__file__).parent
gate=pathlib.Path((base/'dashboard-cache-current-gate.txt').read_text().strip())
state=json.loads((gate/'state.json').read_text())
assert state['status']=='passed' and len(state['gates'])==149 and all(item['exitCode']==0 for item in state['gates']) and not state['changedSources']
manifest=json.loads((gate/'source-manifest.json').read_text())
assert all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==value for name,value in manifest.items())
nextProof=json.loads((base/'personalized-cache-next-results.json').read_text());supervisor=json.loads((base/'personalized-cache-next-supervisor.json').read_text())
assert nextProof['passed']==17 and len(nextProof['cases'])==17 and nextProof['checkedAt']>=state['startedAt']
assert supervisor['status']=='passed' and supervisor['evidenceValid'] and supervisor['stopExitCode']==0 and supervisor['postStopStatusExitCode']==3 and supervisor['privateFolderRemoved']
entries=[];assets={}
for route in ['hr/dashboard','hr/organization','hr/settings','kintai/dashboard']:
 p=pathlib.Path('.next/server/app/api')/route/'route.js';assert p.is_file();h=hashlib.sha256(p.read_bytes()).hexdigest();entries.append({'route':'/api/'+route,'file':str(p),'hash':h});assets[str(p)]=h
matches=[]
for p in pathlib.Path('.next/server/chunks').glob('*.js'):
 text=p.read_text()
 if 'private, no-store' in text and 'Cookie' in text and 'Cache-Control' in text and 'Vary' in text:
  matches.append(str(p));assets[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
assert matches,'Compiled private-cache helper not found'
p=base/'dashboard-cache-release-review.json';review=json.loads(p.read_text());review.update(gate=str(gate),reviewStatus='passed149-actualNext17-compiled-proof-awaiting-final-allowlist-review',compiledMarkerProof={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':{'full149':True,'frozenSourcesUnchanged':True,'actualNext17':True,'privatePostgresStoppedAndRemoved':True,'fourBuiltApiEntries':len(entries)==4,'compiledPrivateCachePolicy':bool(matches)},'apiEntries':entries,'assets':assets,'helperMarkerAssets':matches,'scope':'Actual four built API entries hashed; cache-policy markers in compiled server chunks. Actual Next17 tests prove route behavior; marker search alone is not treated as route execution or production verification.'});p.write_text(json.dumps(review,indent=2)+'\n');print(json.dumps({'status':'prepared','apiEntries':len(entries),'markerAssets':len(matches),'readyToPublish':False}))
