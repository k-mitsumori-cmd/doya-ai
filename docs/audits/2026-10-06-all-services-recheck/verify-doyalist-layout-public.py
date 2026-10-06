import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_9qCmbj8EyeYC5MKzReuQp22TB2As'
paths=['/doyalist','/doyalist/tools/form']
def read(path):
 req=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=20) as r:
  body=r.read(3000000).decode('utf-8');return r.status,body
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: values=list(pool.map(read,paths))
pages=[];scripts=set();page_scripts={}
for path,(status,body) in zip(paths,values):
 pages.append({'path':path,'status':status,'deploymentMarker':dpl in body})
 urls={urllib.parse.urljoin(origin,s.replace('&amp;','&')) for s in re.findall(r'<script[^>]+src="([^"]+)"',body)}
 page_scripts[path]=urls;scripts.update(urls)
scripts=sorted(scripts)
assert all(urllib.parse.urlparse(s).netloc==urllib.parse.urlparse(origin).netloc and '/_next/static/' in s for s in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: chunks=list(pool.map(read,scripts))
lookup=dict(zip(scripts,chunks));checks=[]
for url,(status,body) in lookup.items():
 checks.append({'url':url,'status':status})
for page in pages:
 body='\n'.join(lookup[url][1] for url in page_scripts[page['path']])
 page['boundedReadPublished']='Billing response could not be confirmed' in body
 page['draftRetentionPublished']='プラン未確認' in body and '認証情報を確認しています。' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'5c9b1512d75fc180635fa0e9245fb60a1c100bed','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous Doyalist HTML and published layout authentication-status/unknown-plan/bounded reader code only; new ToolForm quota/response repairs are not included in this deployment. No private generation, account transitions or device QA proof.'}
(base/'doyalist-layout-public-5c9b1512.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] for p in pages)
assert all(p['draftRetentionPublished'] and p['boundedReadPublished'] for p in pages)
assert all(p['status']==200 for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'status':'passed'}))
