import sys, subprocess, pathlib, json, urllib.request, urllib.error, re, datetime
base = pathlib.Path(__file__).parent
marker, commit = sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+', marker) and re.fullmatch(r'[a-f0-9]{40}', commit)
subprocess.run(['python3', str(base/'verify-seo-template-public.py'), marker, commit], check=True)
origin = 'https://doya-ai.surisuta.jp'
rows = []
for path in ['/api/hr/dashboard', '/api/hr/organization', '/api/hr/settings', '/api/kintai/dashboard']:
    request = urllib.request.Request(origin+path, headers={'Cache-Control':'no-cache'})
    try:
        response = urllib.request.urlopen(request, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(4097)
        assert len(raw) <= 4096 and response.status == 401
        body = json.loads(raw)
        headers = {k.lower(): ', '.join(response.headers.get_all(k, [])) for k in response.headers.keys()}
        assert headers.get('cache-control') == 'private, no-store'
        assert 'cookie' in [v.strip().lower() for v in headers.get('vary','').split(',')]
        assert set(body) == {'error'} and isinstance(body['error'], str)
        rows.append({'path':path,'status':401,'privateNoStore':True,'varyCookie':True,'genericErrorOnly':True})
report = {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'routes':rows,'scope':'Inherited exact-deployment17-service/static/SEO/banner checks plus anonymous no-cookie4 GET401 private headers. No customer/production database writes or actual production OAuth/customer cache execution.'}
(base/'dashboard-cache-public.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report))
