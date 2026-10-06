import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_5ArX2MuBp8s2N32jSA8Kuzspbpm7'
paths=['/doyalist']
def read(path):
 req=urllib.request.Request(urllib.parse.urljoin(origin,path),headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=20) as r:
  body=r.read(4000000).decode('utf-8');return r.status,body
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:values=list(pool.map(read,paths))
pages=[];scripts=set();page_scripts={}
for path,(status,body) in zip(paths,values):
 pages.append({'path':path,'status':status,'deploymentMarker':dpl in body})
 urls={urllib.parse.urljoin(origin,s.replace('&amp;','&')) for s in re.findall(r'<script[^>]+src="([^"]+)"',body)}
 page_scripts[path]=urls;scripts.update(urls)
scripts=sorted(scripts)
assert all(urllib.parse.urlparse(s).netloc==urllib.parse.urlparse(origin).netloc and '/_next/static/' in s for s in scripts)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:chunks=list(pool.map(read,scripts))
lookup=dict(zip(scripts,chunks))
for page in pages:
 body='\n'.join(lookup[url][1] for url in page_scripts[page['path']])
 page['unknownOutcomeCopy']='作成・保存結果を確認できませんでした。保存済みのプロジェクトを確認してから、再度お試しください。' in body
 page['strictQuotaMessage']='利用枠を確認できませんでした。時間をおいて再度お試しください。' in body
 page['boundedQuotaReader']='Billing response could not be confirmed' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'be94f76db38a1f0789ee9ee7f0a01c070d766fb1','deployment':dpl,'pages':pages,'scripts':[{'url':u,'status':s} for u,(s,_) in lookup.items()],'scope':'Anonymous HTML and published client code only. Does not establish authenticated business generation, actual DB persistence or provider behavior.'}
published=all(p['unknownOutcomeCopy'] and p['strictQuotaMessage'] and p['boundedQuotaReader'] for p in pages)
passed=all(p['status']==200 and p['deploymentMarker'] for p in pages) and all(s==200 for s,_ in chunks)
result['status']='passed-code-published' if passed and published else 'not-proven-anonymous-tool' if passed else 'not-proven-deployment'
result['scope']='Anonymous Doyalist entry and its published assets only. The server renders the collection Tool only for authenticated sessions; absent Tool code is unproven, not a deployment failure. Even published code does not prove private business generation or actual DB writes.'
(base/'doyalist-collect-public-be94f76d.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'pages':len(pages),'scripts':len(scripts),'status':result['status']}))
raise SystemExit(0 if passed else 1)
