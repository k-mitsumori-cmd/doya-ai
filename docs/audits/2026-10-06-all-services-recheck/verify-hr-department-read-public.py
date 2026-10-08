import sys,subprocess,pathlib,json,urllib.request,urllib.error,urllib.parse,re,datetime,html as html_parser
base=pathlib.Path(__file__).parent
marker,commit=sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+',marker) and re.fullmatch(r'[a-f0-9]{40}',commit)
subprocess.run(['python3',str(base/'verify-hr-department-operation-public.py'),marker,commit],check=True)
origin='https://doya-ai.surisuta.jp';routes=[];pages=[];cache={}
for query in ['format=pages','format=pages&cursor=invalid','format=pages&format=pages']:
 route='/api/hr/departments?'+query
 try:r=urllib.request.urlopen(urllib.request.Request(origin+route,headers={'Cache-Control':'no-cache'}),timeout=25)
 except urllib.error.HTTPError as error:r=error
 with r:
  raw=r.read(4097);assert r.status==401 and len(raw)<=4096;data=json.loads(raw);assert set(data)=={'error'} and isinstance(data['error'],str)
  assert ','.join(r.headers.get_all('cache-control') or [])=='private, no-store';assert 'cookie' in [x.strip().lower() for x in ','.join(r.headers.get_all('vary') or []).split(',')]
  routes.append({'path':route,'status':401,'privateNoStore':True,'authBeforeCursorValidation':True})
for route,markers in [('/hr/settings',['/api/hr/departments?format=pages','hr-department-page-v1','X-HR-Organization-Id']),('/hr/employees/new',['/api/hr/departments?format=pages','hr-department-page-v1','部署一覧を再取得する','認証情報を確認しています。']),('/hr/employees/synthetic-public-read-probe/edit',['/api/hr/departments?format=pages','hr-department-page-v1','現在の所属（部署一覧で未確認）','未所属へ自動変更することはありません。','従業員情報を再取得する'])]:
 with urllib.request.urlopen(urllib.request.Request(origin+route,headers={'Cache-Control':'no-cache'}),timeout=25) as r:
  assert r.status==200;raw=r.read(1024*1024+1);assert len(raw)<=1024*1024
 urls=sorted(set(html_parser.unescape(url) for url in re.findall(r'(?:src|href)="(/_next/static/[^"<>]+\.js(?:\?[^"<>]*)?)"',raw.decode('utf-8'))));assert urls and len(urls)<=100
 for url in urls:
  parsed=urllib.parse.urlsplit(url);assert not parsed.scheme and not parsed.netloc and parsed.path.startswith('/_next/static/') and parsed.path.endswith('.js');assert urllib.parse.parse_qs(parsed.query).get('dpl')==[marker]
  if url not in cache:
   with urllib.request.urlopen(origin+url,timeout=25) as r:
    assert r.status==200;body=r.read(4*1024*1024+1);assert len(body)<=4*1024*1024;cache[url]=body.decode('utf-8')
 bundle='\n'.join(cache[url] for url in urls);assert all(value in bundle for value in markers),(route,'Required candidate client marker absent')
 pages.append({'path':route,'status':200,'referencedJsChunks':len(urls),'verifiedMarkers':markers})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'routes':routes,'pages':pages,'scope':'Inherited17-service public checks and exact deployment identity. Anonymous paged department requests remain private401 before query validation. All three page bundles reference the released paged contract and recovery UI. Read-only unauthenticated probes; no production customer/authenticated operation or real OAuth claim. Whole17service2074criterion189GET audit remains active.'}
(base/'hr-department-read-public.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
