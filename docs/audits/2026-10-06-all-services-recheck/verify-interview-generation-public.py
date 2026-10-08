import sys,subprocess,pathlib,json,urllib.request,urllib.parse,urllib.error,re,datetime,concurrent.futures
base=pathlib.Path(__file__).parent;marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-media-storage-privacy-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp'
def get(url):
 request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=25) as r:return r.status,r.read(4000000).decode('utf-8'),r.url
status,html,final=get(origin+'/interview/projects/synthetic-public-probe/generate?recipeId=synthetic-public-recipe')
assert status==200 and marker in html and urllib.parse.urlparse(final).netloc=='doya-ai.surisuta.jp'
scripts=sorted({urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',html)})
assert scripts and all(urllib.parse.urlparse(u).netloc=='doya-ai.surisuta.jp' and '/_next/static/' in u for u in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(get,scripts))
assert all(a[0]==200 for a in assets)
code='\n'.join(a[1] for a in assets);needles=['記事生成を開始','新しい記事を生成（1回使用）','interview-article-intent:v1:','生成内容を引き継げませんでした','保存済みの記事を確認しました']
markers={n:n in code for n in needles};assert all(markers.values())
# No cookies/session; operation recovery GET cannot create a lease or invoke a provider.
request=urllib.request.Request(origin+'/api/interview/articles/generate?projectId=synthetic-public-probe&operationId=10000000-0000-4000-8000-000000000001',headers={'Cache-Control':'no-cache'})
try:
 urllib.request.urlopen(request,timeout=25);raise AssertionError('Anonymous recovery unexpectedly admitted')
except urllib.error.HTTPError as error:
 assert error.code==401 and error.headers.get('Cache-Control')=='private, no-store' and 'cookie' in error.headers.get('Vary','').lower()
 unauthorized=error.code
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'pageStatus':status,'finalPath':urllib.parse.urlparse(final).path,'assetCount':len(scripts),'markers':markers,'anonymousArticleRecovery':unauthorized,'passed':True,'scope':'Anonymous read-only public17-service pages/static assets and Interview generation client bundle with exact deployment marker; unauthenticated operation GET401. No authenticated generation, real provider, customer project/data or quota E2E claim.'}
(base/'interview-generation-public.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,ensure_ascii=False))
