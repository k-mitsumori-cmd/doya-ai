import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_3Ryf4AUnsM8GRiQfiujng2eALLxn'
paths=['/banner/dashboard','/banner/test','/banner/dashboard/create','/banner/dashboard/chat']
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
 page['boundedQuotaReader']='Quota response too large' in body and 'Quota request timed out' in body
 page['integerValidation']='Number.isSafeInteger' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'cfa921659dff49202b8290e3ec04d1a5ed8ec76e','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous HTML and published quota reader/integer validation code only. No authenticated generation, customer capacity reservation or device QA proof.'}
(base/'banner-quota-client-public-cfa92165.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] and p['boundedQuotaReader'] and p['integerValidation'] for p in pages)
assert all(p['status']==200 for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'status':'passed'}))
