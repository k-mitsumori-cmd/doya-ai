import sys,subprocess,pathlib,json,urllib.request,urllib.parse,urllib.error,re,datetime,concurrent.futures
base=pathlib.Path(__file__).parent;marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-media-storage-privacy-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp'
def get(url):
 request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=25) as r:return r.status,r.read(4000000).decode('utf-8'),r.url
status,html,final=get(origin+'/aio')
assert status==200 and marker in html and urllib.parse.urlparse(final).netloc=='doya-ai.surisuta.jp'
scripts=sorted({urllib.parse.urljoin(origin,u.replace('&amp;','&')) for u in re.findall(r'<script[^>]+src="([^"]+)"',html)})
assert scripts and all(urllib.parse.urlparse(u).netloc=='doya-ai.surisuta.jp' and '/_next/static/' in u for u in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(get,scripts))
assert all(a[0]==200 for a in assets)
code='\n'.join(a[1] for a in assets);needles=['aio-quick-start-intent:v1:','保存状況を確認','開始処理を続ける','この操作を終了','保存結果を開く']
markers={n:n in code for n in needles};assert all(markers.values())
# No cookies/session; operation recovery GET cannot create a lease or invoke a provider.
request=urllib.request.Request(origin+'/api/aio/quick-start?operationId=10000000-0000-4000-8000-000000000001',headers={'Cache-Control':'no-cache'})
try:
 urllib.request.urlopen(request,timeout=25);raise AssertionError('Anonymous recovery unexpectedly admitted')
except urllib.error.HTTPError as error:
 assert error.code==401 and error.headers.get('Cache-Control')=='private, no-store' and 'cookie' in [value.strip().lower() for header in error.headers.get_all('Vary', []) for value in header.split(',')]
 unauthorized=error.code

# Read-only authenticated-boundary probes. Never accept invitations, create organizations or invoke paid generation in production.
anonymous=[]
for path in ['/api/promane/workspaces','/api/hr/organization','/api/quote/organizations','/api/mensetsu/organizations','/api/aishodan/organizations']:
 request=urllib.request.Request(origin+path,headers={'Cache-Control':'no-cache'})
 try:
  urllib.request.urlopen(request,timeout=25);raise AssertionError('Anonymous organization listing unexpectedly admitted '+path)
 except urllib.error.HTTPError as error:
  assert error.code==401, (path,error.code)
  anonymous.append({'path':path,'status':error.code})
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'pageStatus':status,'anonymousOrganizationReads':anonymous,'finalPath':urllib.parse.urlparse(final).path,'assetCount':len(scripts),'markers':markers,'anonymousQuickStartRecovery':unauthorized,'passed':True,'scope':'Anonymous read-only public17-service pages/static assets and AIO quick-start client bundle with exact deployment marker; unauthenticated operation GET401. Includes five anonymous organization listings401. No authenticated production role-change/invitation acceptance/quick-start, real provider, customer data or production quota E2E claim.'}
(base/'membership-role-public.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,ensure_ascii=False))
