import sys,subprocess,pathlib,json,urllib.request,urllib.parse,re,datetime,concurrent.futures
base=pathlib.Path(__file__).parent;marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-membership-role-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as r:
  body=r.read(4000001);assert len(body)<=4000000
  return r.status,body.decode('utf-8'),r.url,{k.lower(): ', '.join(r.headers.get_all(k, [])) for k in r.headers.keys()}
paths=['/banner/dashboard','/banner/test','/banner/dashboard/create','/banner/dashboard/chat'];pages=[];scripts={}
for path in paths:
 status,html,final,headers=get(origin+path);assert status==200 and marker in html and urllib.parse.urlparse(final).netloc=='doya-ai.surisuta.jp' and urllib.parse.urlparse(final).path==path
 urls=sorted({urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',html)})
 assert urls and all(urllib.parse.urlparse(u).netloc=='doya-ai.surisuta.jp' and '/_next/static/' in u for u in urls)
 scripts[path]=urls;pages.append({'path':path,'status':status,'scriptCount':len(urls)})
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 urls=sorted({u for values in scripts.values() for u in values});assets=dict(zip(urls,pool.map(get,urls)))
assert all(a[0]==200 for a in assets.values());checks={}
for path,urls in scripts.items():
 code='\n'.join(assets[url][1] for url in urls);checks[path]={'scopeBoundLimitReporter':'reportLimit' in code,'openNoticeScope':'wasOpen' in code and 'notified' in code}
 if path in ['/banner/dashboard','/banner/test']:
  checks[path]['boundedGenerationGuidance']='生成の応答を確認できませんでした。履歴を確認してから再試行してください。' in code
  checks[path]['boundedEditGuidance']='修正の応答を確認できませんでした。履歴を確認してから再試行してください。' in code
 assert all(checks[path].values()),(path,checks[path])
status,body,final,headers=get(origin+'/api/usage/banner');normalized={k.lower():v for k,v in headers.items()};assert status==200 and json.loads(body)=={'signedIn':False} and normalized.get('cache-control')=='private, no-store' and 'cookie' in [v.strip().lower() for v in normalized.get('vary','').split(',')]
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'pages':pages,'assetCount':len(assets),'markers':checks,'anonymousUsage':{'status':status,'signedIn':False,'privateNoStore':True,'varyCookie':True},'scope':'Exact deployment marker; public17-service/static checks and prior anonymous role boundaries, four banner page bundles and anonymous usage GET. No generation POST, paid provider, OAuth, customer account or production quota writes; actual production account/plan transitions remain unverified.'}
(base/'banner-scope-public.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
