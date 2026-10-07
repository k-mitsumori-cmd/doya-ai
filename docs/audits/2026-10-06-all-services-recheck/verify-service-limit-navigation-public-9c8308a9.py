import concurrent.futures,urllib.request,urllib.parse,re,json,pathlib,datetime
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp';marker='dpl_GoEDfyS1r9SMMuQLMNzSKaMqx577'
services=['banner','seo','interview','persona','hr','kintai','doyalist','promane','doyaslide','cunning','sfa','shodan','aio','mensetsu','quote','aishodan','adimage']
def get(path):
 request=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=20) as r:return r.status,r.read(4000000).decode('utf-8'),{k.lower(): ', '.join(r.headers.get_all(k) or []) for k in r.headers.keys()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:entries=list(pool.map(get,['/'+s for s in services]))
sweep=[{'service':s,'status':v[0],'deploymentMarker':marker in v[1]} for s,v in zip(services,entries)]
pages=[];scripts=set()
for path in ['/doyaslide/new','/cunning/pricing','/quote','/quote/pricing','/quote/settings']:
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
passed=quoteApi['status']==200 and quoteApi['signedIn'] is False and 'private' in (quoteApi['cacheControl'] or '') and 'no-store' in (quoteApi['cacheControl'] or '') and quoteApi['varyCookie'] and all(x['status']==200 and x['deploymentMarker'] for x in sweep+pages) and all(v[0]==200 for v in values) and all(x['status']==200 and x['guest'] and 'private' in (x['cacheControl'] or '') and 'no-store' in (x['cacheControl'] or '') and x['varyCookie'] for x in apis)
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'9c8308a9dde221e745f246c387d9e3a47121bcc2','deployment':marker,'status':'anonymous-publication-passed-private-form-unproven' if passed else 'not-proven-current-deployment','entries':sweep,'pages':pages,'assets':len(scripts),'guestApis':apis,'quoteAnonymousUsage':quoteApi,'scope':'Anonymous read-only HTML/assets and guest usage only. Does not prove authenticated wrapper/child behavior, private customer flows, actual AI generation, DB persistence or browser interaction. If alias advanced, absent old marker is not itself a bug.'}
(base/'service-limit-navigation-public-9c8308a9.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':result['status'],'entries':len(sweep),'assets':len(scripts),'guestApis':apis}));raise SystemExit(0 if passed else 1)
