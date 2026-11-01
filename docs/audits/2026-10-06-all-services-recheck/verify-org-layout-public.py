import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_45jLJQsvuQTKDmbqzNVt8RxVSw8s'
paths=['/hr/dashboard','/kintai/clock']
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
 page['draftRetentionPublished']='入力内容は保持しています。' in body and '認証情報を確認しています。' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'4fa6d261e3143f7c5bf6f9e49d792e70ea71fafc','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous HR/Kintai HTML and published draft-retention/bounded reader code; no authenticated HR records, membership changes, clock writes or native inert/device QA proof.'}
(base/'org-layout-public-4fa6d261.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] for p in pages)
assert all(p['draftRetentionPublished'] and p['boundedReadPublished'] for p in pages)
assert all(p['status']==200 for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'status':'passed'}))
