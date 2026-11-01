import sys,subprocess,pathlib,json,urllib.request,urllib.error,re,datetime
base=pathlib.Path(__file__).parent
marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-seo-durable-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp';rows=[]
for path in ['/api/hr/departments','/api/hr/org-chart','/api/kintai/departments']:
 request=urllib.request.Request(origin+path,headers={'Cache-Control':'no-cache'})
 try:response=urllib.request.urlopen(request,timeout=25)
 except urllib.error.HTTPError as error:response=error
 with response:
  raw=response.read(4097);assert len(raw)<=4096 and response.status==401,path
  data=json.loads(raw);assert set(data)=={'error'} and isinstance(data['error'],str),path
  vary=response.headers.get_all('vary') or [];cache=response.headers.get_all('cache-control') or []
  assert ','.join(cache)=='private, no-store' and 'cookie' in [v.strip().lower() for v in ','.join(vary).split(',')],path
  rows.append({'path':path,'status':401,'privateNoStore':True,'varyCookie':True,'genericErrorOnly':True,'varyHeaderValues':vary})
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'routes':rows,'scope':'Inherited exact-deployment17-service/static/SEO durable/banner/four cache checks plus three additional anonymous no-cookie GET401 private headers. No production/customer database writes, real OAuth, provider generation or actual customer cache execution.'}
(base/'hr-kintai-additional-cache-public.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
