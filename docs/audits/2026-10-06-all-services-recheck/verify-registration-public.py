import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_BvqTE9B4BLxJEUdFpm3EmHgwDQ6u'
paths=[p['path'] for p in json.loads((base/'analytics-services-public-5fe7658e.json').read_text())['pages']]
def read(path):
 req=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=20) as r:
  body=r.read(3000000).decode('utf-8');return r.status,body
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: values=list(pool.map(read,paths))
pages=[];scripts=set()
for path,(status,body) in zip(paths,values):
 pages.append({'path':path,'status':status,'deploymentMarker':dpl in body})
 scripts.update(urllib.parse.urljoin(origin,s.replace('&amp;','&')) for s in re.findall(r'<script[^>]+src="([^"]+)"',body))
scripts=sorted(scripts)
assert all(urllib.parse.urlparse(s).netloc==urllib.parse.urlparse(origin).netloc and '/_next/static/' in s for s in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: chunks=list(pool.map(read,scripts))
checks=[]
for url,(status,body) in zip(scripts,chunks):
 checks.append({'url':url,'status':status,'creationDateClassifier':'.createdAt' in body and 'toISOString()' in body and 'Date.parse(' in body and ('18e5' in body or '1800000' in body),'accountScopedLoginGuard':'ga_login_sent:' in body and 'encodeURIComponent(' in body})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'31c684bbc05eddf1f1494ed61c4695c9524b522d','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous HTML and published script reflection only. No actual OAuth, server notification delivery, analytics delivery or customer operation proof.'}
(base/'registration-public-31c684bb.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] for p in pages)
assert all(p['status']==200 for p in checks)
assert any(p['creationDateClassifier'] and p['accountScopedLoginGuard'] for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'creationDateClassifier':True,'status':'passed'}))
