import sys,concurrent.futures,urllib.request,urllib.parse,urllib.error,re,json,pathlib,datetime
base=pathlib.Path(__file__).parent
marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
origin='https://doya-ai.surisuta.jp'
def get(path):
 request=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 try:response=urllib.request.urlopen(request,timeout=25)
 except urllib.error.HTTPError as e:response=e
 with response as r:return r.status,r.read(4000000).decode('utf-8'),{k.lower(): ', '.join(r.headers.get_all(k) or []) for k in r.headers.keys()}
services=['banner','seo','interview','persona','hr','kintai','doyalist','promane','doyaslide','cunning','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:values=list(pool.map(get,['/'+s for s in services]))
entries=[{'service':s,'status':v[0],'deploymentMarker':marker in v[1]} for s,v in zip(services,values)]
pages=[];scripts=set()
for path in ['/adimage']:
 status,body,headers=get(path);urls={urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',body)};scripts.update(urls);pages.append({'path':path,'status':status,'deploymentMarker':marker in body,'assets':sorted(urls)})
assert scripts and all(urllib.parse.urlparse(u).netloc==urllib.parse.urlparse(origin).netloc and '/_next/static/' in u for u in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:assetValues=list(pool.map(get,sorted(scripts)))
lookup=dict(zip(sorted(scripts),assetValues));required=['adimage-intent:v1:','保存結果を確認','結果を確認しました','画像生成の結果確認']
for page in pages:
 code='\n'.join(lookup[u][1] for u in page.pop('assets'));page['recoveryMarkers']={needle:needle in code for needle in required[:3]};page['recoveryLabel']=required[3] in code
status,body,headers=get('/api/adimage/operations?operationId=10000000-0000-4000-8000-000000000001&targetId=audit-readonly-release-check&kind=generate');data=json.loads(body)
private={'status':status,'success':data.get('success'),'hasImage':any(k in data for k in ['creatives','previousCreatives','conceptId','receipt','operationId']),'cacheControl':headers.get('cache-control'),'varyCookie':'cookie' in headers.get('vary','').lower()}
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'entries':entries,'pages':pages,'assetCount':len(scripts),'assetStatuses':[r[0] for r in assetValues],'guestRecovery':private,'scope':'Anonymous read-only public HTML/assets and unauthenticated operation GET only. Presence of deployed recovery code is not authenticated execution, provider or customer data E2E.'}
result['passed']=all(e['status']==200 and e['deploymentMarker'] for e in entries) and all(p['status']==200 and p['deploymentMarker'] and all(p['recoveryMarkers'].values()) for p in pages) and pages[0]['recoveryLabel'] and all(r[0]==200 for r in assetValues) and private['status']==401 and not private['hasImage'] and 'no-store' in (private['cacheControl'] or '') and 'private' in (private['cacheControl'] or '') and private['varyCookie']
(base/'adimage-operation-public.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'entries':len(entries),'assets':len(scripts),'pages':pages,'guestRecovery':private},ensure_ascii=False));assert result['passed']
