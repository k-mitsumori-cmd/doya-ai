import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_4SxZSo31nJJoGMn7UCQW2Ntfexu5'
paths=['/interview/projects/new','/interview/projects']
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
 if page['path'].startswith('/interview'):
  page['reservedMinutesPublished']='reservedMinutes' in body
  page['reservationLabelPublished']='処理中の予約' in body or '予約' in body
 else:
  page['sharedUsagePublished']='Number.isSafeInteger' in body and 'usage-changed' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'798212dfb6da6d0b859f9444b658a8b4b4569137','deployment':dpl,'pages':pages,'scripts':checks,'scope':'Anonymous published interview reservation usage and bounded reader code. SEO authenticated layout is omitted for anonymous users and is not publicly proven by this check; no authenticated generation, actual reservation or device QA proof.'}
(base/'interview-sidebar-public-798212df.json').write_text(json.dumps(result,indent=2)+'\n')
assert all(p['status']==200 and p['deploymentMarker'] for p in pages)
assert all(p['reservedMinutesPublished'] and p['boundedReadPublished'] and p['reservationLabelPublished'] for p in pages)
assert all(p['status']==200 for p in checks)
print(json.dumps({'pages':len(pages),'scripts':len(checks),'status':'passed'}))
