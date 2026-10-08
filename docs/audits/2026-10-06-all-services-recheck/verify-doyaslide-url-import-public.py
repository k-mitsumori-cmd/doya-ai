import sys,subprocess,pathlib,json,urllib.request,urllib.parse,re,datetime,concurrent.futures
base=pathlib.Path(__file__).parent;marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-media-storage-privacy-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp'
def get(url):
 request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=25) as r:return r.status,r.read(4000000).decode('utf-8'),r.url
status,html,final=get(origin+'/doyaslide/new')
assert status==200 and marker in html and urllib.parse.urlparse(final).netloc=='doya-ai.surisuta.jp'
scripts=sorted({urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',html)})
assert scripts and all(urllib.parse.urlparse(u).netloc=='doya-ai.surisuta.jp' and '/_next/static/' in u for u in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(get,scripts))
assert all(a[0]==200 for a in assets)
code='\n'.join(a[1] for a in assets);needles=['取り込み結果を確認','取り込みを取消','保存結果を取り込む','保存結果を使わず終了','doyaslide-url-intent:v1:']
markers={n:n in code for n in needles};assert all(markers.values())
# No cookie jar or credentials: this API returns only public cache for guests and cannot claim a generation lease.
apiStatus,body,_=get(origin+'/api/doyaslide/style-preview?style=corporate');data=json.loads(body)
assert apiStatus==200 and data.get('pending') is False and isinstance(data.get('urls'),list) and len(data['urls'])<=3
assert data.get('url')==(data['urls'][0] if data['urls'] else None)
assert all(isinstance(u,str) and urllib.parse.urlparse(u).scheme=='https' for u in data['urls'])
# Anonymous requests must not reach an actor receipt or reserve attempts.
unauthorized={}
for method in ['GET','DELETE','POST']:
 request=urllib.request.Request(origin+'/api/doyaslide/analyze?operationId=10000000-0000-4000-8000-000000000001',method=method,headers={'Content-Type':'application/json','Cache-Control':'no-cache'},data=(b'{}' if method=='POST' else None))
 try:
  urllib.request.urlopen(request,timeout=25);raise AssertionError('Anonymous analysis unexpectedly admitted')
 except urllib.error.HTTPError as error:
  assert error.code==401
  assert error.headers.get('Cache-Control')=='private, no-store'
  unauthorized[method]=error.code
report={'anonymousAnalysis':unauthorized,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'pageStatus':status,'finalPath':urllib.parse.urlparse(final).path,'assetCount':len(scripts),'markers':markers,'guestPreview':{'status':apiStatus,'pending':data['pending'],'publicImageCount':len(data['urls'])},'passed':True,'scope':'Anonymous read-only public17-service pages, static assets and guest cache-only Slide preview GET and anonymous analysis401. Confirms exact deployment and deployed durable recovery copy; authenticated production interactions, customer data and provider generation are not exercised.'}
(base/'doyaslide-url-import-public.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,ensure_ascii=False))
