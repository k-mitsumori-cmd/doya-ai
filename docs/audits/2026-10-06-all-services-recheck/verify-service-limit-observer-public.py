import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl=json.loads((base/'service-limit-observer-inspect-74cb5e58.json').read_text())['id']
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
 checks.append({'url':url,'status':status,'boundedLimitInspection':'Limit inspection timed out' in body and 'TextDecoder' in body,'transitionScopedNotice':'doya:service-limit' in body and bool(re.search(r'version\s*\+\s*1',body))})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'74cb5e58569c62a5e38f0629cbf6336c2adca9aa','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous HTML and published script reflection only. No actual authenticated quota, billing, trial eligibility or device operation proof.'}
(base/'service-limit-observer-public-74cb5e58.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] for p in pages)
assert all(p['status']==200 for p in checks)
assert any(p['boundedLimitInspection'] and p['transitionScopedNotice'] for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'boundedLimitInspection':True,'status':'passed'}))
