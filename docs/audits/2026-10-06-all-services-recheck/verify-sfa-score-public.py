import sys,concurrent.futures,urllib.request,urllib.parse,re,json,pathlib,datetime
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp';marker=sys.argv[1];commit=sys.argv[2]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
services=['banner','seo','interview','persona','hr','kintai','doyalist','promane','doyaslide','cunning','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
def get(path):
 request=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=20) as r:return r.status,r.read(4000000).decode('utf-8'),{k.lower(): ', '.join(r.headers.get_all(k) or []) for k in r.headers.keys()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:entries=list(pool.map(get,['/'+s for s in services]))
sweep=[{'service':s,'status':v[0],'deploymentMarker':marker in v[1]} for s,v in zip(services,entries)]
pages=[];scripts=set()
for path in ['/doyaslide/new','/cunning/pricing','/quote','/quote/pricing','/quote/settings','/sfa/audit-verification','/sfa/audit-verification/tasks','/sfa/audit-verification/activities','/sfa/audit-verification/deals','/sfa/audit-verification/leads']:
 status,body,headers=get(path);urls={urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',body)};scripts.update(urls);pages.append({'path':path,'status':status,'deploymentMarker':marker in body,'assets':sorted(urls)})
assert all(urllib.parse.urlparse(u).netloc==urllib.parse.urlparse(origin).netloc and '/_next/static/' in u for u in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:values=list(pool.map(get,sorted(scripts)))
lookup=dict(zip(sorted(scripts),values))
for p in pages:
 code='\n'.join(lookup[u][1] for u in p.pop('assets'));p['popupCssPresent']='hs-web-interactives-top-anchor' in code
apis=[]
for service in ['doyaslide','cunning']:
 status,body,h=get('/api/'+service+'/usage');lower={k.lower():v for k,v in h.items()};data=json.loads(body);apis.append({'service':service,'status':status,'guest':data.get('plan')=='GUEST','cacheControl':lower.get('cache-control'),'varyCookie':'cookie' in lower.get('vary','').lower()})
status,body,h=get('/api/usage/quote');data=json.loads(body);quoteApi={'status':status,'signedIn':data.get('signedIn'),'cacheControl':h.get('cache-control'),'varyCookie':'cookie' in h.get('vary','').lower()}
sfaAssets = '\n'.join(lookup[u][1] for u in sorted(scripts))
sfaMarkers = {needle: needle in sfaAssets for needle in ['doya:sfa:pending:v1:', '未保存ならこの操作を取り消す', '保存結果を確認']}
dealMarkers={needle:needle in sfaAssets for needle in ['?recovery=1', 'deal:', '/api/sfa/deals/']}
conversionMarkers={needle:needle in sfaAssets for needle in ['conversion:', '取引先・商談を作成する', 'リード転換の確認']}
crudMarkers={needle:needle in sfaAssets for needle in ['lead:create', 'lead-import:create', '取込記録を確認しました', 'expectedUpdatedAt', '送信後に変更したCSV']}
scoreMarkers={needle:needle in sfaAssets for needle in ['score:', '/api/sfa/ai/score', '保存済みのAI判定結果', '判定は保存されておらず', 'その後の変更は含まれません']}
sfaApis=[]
for path in ['/api/sfa/ai/score?leadId=audit-verification&operationId=10000000-0000-4000-8000-000000000001&org=audit-verification','/api/sfa/leads?org=audit-verification','/api/sfa/leads/import?operationId=10000000-0000-4000-8000-000000000001&org=audit-verification','/api/sfa/leads/audit-verification?org=audit-verification','/api/sfa/leads/audit-verification/convert?operationId=10000000-0000-4000-8000-000000000001&org=audit-verification','/api/sfa/tasks?org=audit-verification', '/api/sfa/activities?org=audit-verification', '/api/sfa/tasks/audit-verification?org=audit-verification']:
 try: status,body,h=get(path)
 except urllib.error.HTTPError as e:
  status=e.code; body=e.read(100000).decode('utf-8');h={k.lower(): ', '.join(e.headers.get_all(k) or []) for k in e.headers.keys()}
 data=json.loads(body)
 sfaApis.append({'path':path,'status':status,'hasError':isinstance(data.get('error'),str),'cacheControl':h.get('cache-control'),'varyCookie':'cookie' in h.get('vary','').lower()})
passed=all(scoreMarkers.values()) and all(crudMarkers.values()) and all(conversionMarkers.values()) and all(dealMarkers.values()) and all(sfaMarkers.values()) and all(x['status']==401 and x['hasError'] and 'private' in (x['cacheControl'] or '') and 'no-store' in (x['cacheControl'] or '') and x['varyCookie'] for x in sfaApis) and quoteApi['status']==200 and quoteApi['signedIn'] is False and 'private' in (quoteApi['cacheControl'] or '') and 'no-store' in (quoteApi['cacheControl'] or '') and quoteApi['varyCookie'] and all(x['status']==200 and x['deploymentMarker'] for x in sweep+pages) and all(v[0]==200 for v in values) and all(x['status']==200 and x['guest'] and 'private' in (x['cacheControl'] or '') and 'no-store' in (x['cacheControl'] or '') and x['varyCookie'] for x in apis)
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'status':'anonymous-publication-passed-private-form-unproven' if passed else 'not-proven-current-deployment','scoreClientMarkers':scoreMarkers,'leadCrudClientMarkers':crudMarkers,'conversionClientMarkers':conversionMarkers,'dealClientMarkers':dealMarkers,'sfaClientMarkers':sfaMarkers,'anonymousSfaApis':sfaApis,'entries':sweep,'pages':pages,'assets':len(scripts),'guestApis':apis,'quoteAnonymousUsage':quoteApi,'scope':'Anonymous read-only HTML/assets, guest usage and unauthenticated SFA 401 responses only. Uses a synthetic org slug; no authenticated browser or DB write. Does not prove authenticated wrapper/child behavior, private customer flows, actual AI generation, DB persistence or browser interaction. If alias advanced, absent old marker is not itself a bug.'}
(base/'sfa-score-public.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':result['status'],'entries':len(sweep),'assets':len(scripts),'guestApis':apis}));raise SystemExit(0 if passed else 1)
