import concurrent.futures,urllib.request,urllib.parse,re,json,datetime,pathlib
base=pathlib.Path(__file__).parent
origin='https://doya-ai.surisuta.jp'
dpl='dpl_5vabnakeoRXdMUNTKNPrftwQF4tC'
paths=['/doyalist/tools/form','/doyalist/tools/email','/doyalist/tools/phone']
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
 page['unknownOutcomeCopy']='生成・保存結果を確認できませんでした。履歴を確認してから、再度お試しください。' in body
 page['loginAction']='ログインして文章生成' in body
 page['boundedQuotaReader']='Billing response could not be confirmed' in body
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':'5ee64c4f22b92108c94a78f9bf35c88cd972061a','deployment':dpl,'pages':pages,'scripts':[{'url':u,'status':s} for u,(s,_) in lookup.items()],'scope':'Anonymous HTML and published client code only. Does not establish authenticated business generation, actual DB persistence or provider behavior.'}
passed=all(p['status']==200 and p['deploymentMarker'] and p['unknownOutcomeCopy'] and p['loginAction'] and p['boundedQuotaReader'] for p in pages) and all(s==200 for s,_ in chunks)
result['status']='passed' if passed else 'not-proven'
(base/'doyalist-tool-public-5ee64c4f.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'pages':len(pages),'scripts':len(scripts),'status':result['status']}))
raise SystemExit(0 if passed else 1)
