import sys,subprocess,pathlib,json,urllib.request,urllib.parse,urllib.error,datetime
b=pathlib.Path(__file__).parent;marker,commit=sys.argv[1:3]
subprocess.run(['python3',str(b/'verify-media-storage-privacy-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp';checks=[]
for path in ['/promane/synthetic-review-check/settings']:
 with urllib.request.urlopen(urllib.request.Request(origin+path,headers={'Cache-Control':'no-cache'}),timeout=25) as r:
  html=r.read(4000000).decode('utf-8');url=urllib.parse.urlparse(r.url);query=urllib.parse.parse_qs(url.query)
  checks.append({'path':path,'status':r.status,'finalPath':url.path,'callbackUrl':query.get('callbackUrl'),'deploymentMarker':marker in html,'passed':r.status==200 and url.netloc=='doya-ai.surisuta.jp' and url.path=='/auth/signin' and query.get('callbackUrl')==['/promane'] and marker in html})
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'checks':checks,'passed':all(c['passed'] for c in checks),'scope':'Read-only anonymous public service surfaces plus protected Promane routes redirecting to sign-in on this deployment. Authenticated deployed workspace forms/API writes, customer data and human QA not verified. Local actual authenticated Next-to-PostgreSQL verification is separate.'}
(b/'promane-workspace-operation-public.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False));assert report['passed']
