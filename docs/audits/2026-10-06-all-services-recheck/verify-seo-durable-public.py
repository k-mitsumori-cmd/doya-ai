import sys,subprocess,pathlib,json,urllib.request,urllib.error,urllib.parse,re,datetime,concurrent.futures
base=pathlib.Path(__file__).parent
marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-dashboard-cache-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp'
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as response:
  raw=response.read(4000001);assert len(raw)<=4000000 and response.status==200
  return raw.decode('utf-8')
html=get(origin+'/seo/template');assert marker in html
urls=sorted({urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',html)})
assert urls and all(urllib.parse.urlparse(u).netloc=='doya-ai.surisuta.jp' and '/_next/static/' in u for u in urls)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:code='\n'.join(pool.map(get,urls))
checks={text:text in code for text in ['seo-article-create-intent:v1:','/api/seo/article-operation?operationId=','前回の記事作成の結果を確認してください','作成結果を確認','未受付の操作を終了','確認して新しい記事作成へ進む','操作情報を安全に保存・確認できません。']}
assert all(checks.values()),checks
request=urllib.request.Request(origin+'/api/seo/article-operation?operationId=11111111-1111-4111-8111-111111111111',headers={'Cache-Control':'no-cache'})
try:response=urllib.request.urlopen(request,timeout=25)
except urllib.error.HTTPError as error:response=error
with response:
 raw=response.read(4097);assert len(raw)<=4096 and response.status==401
 data=json.loads(raw);assert set(data)=={'success','error'} and data['success'] is False and isinstance(data['error'],str)
 assert response.headers.get('cache-control')=='private, no-store' and 'cookie' in [v.strip().lower() for v in response.headers.get('vary','').split(',')]
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'assetCount':len(urls),'markers':checks,'anonymousRecovery':{'status':401,'privateNoStore':True,'varyCookie':True},'scope':'Exact deployment marker, inherited17-service/static/SEO/banner/four cache API checks, SEO durable client bundle markers and anonymous no-cookie recovery401. No production generation, cancellation, OAuth, customer database writes or authenticated production recovery.'}
(base/'seo-durable-public.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
