import sys, subprocess, pathlib, json, urllib.request, urllib.error, urllib.parse, re, datetime, html as html_parser

base = pathlib.Path(__file__).parent
marker, commit = sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+', marker) and re.fullmatch(r'[a-f0-9]{40}', commit)
# Retain the full inherited public checks, including exact deployment identity.
subprocess.run(['python3', str(base / 'verify-hr-department-input-public.py'), marker, commit], check=True)
origin = 'https://doya-ai.surisuta.jp'
rows = []
for route in ['/api/hr/department-operation?operationId=12345678-1234-4234-8234-123456789abc&organizationId=synthetic-public-probe', '/api/hr/department-operation?operationId=invalid&organizationId=synthetic-public-probe']:
    request = urllib.request.Request(origin + route, headers={'Cache-Control': 'no-cache'})
    try:
        response = urllib.request.urlopen(request, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(4097)
        assert response.status == 401 and len(raw) <= 4096, route
        data = json.loads(raw)
        assert set(data) == {'error'} and isinstance(data['error'], str), route
        vary = response.headers.get_all('vary') or []
        cache = response.headers.get_all('cache-control') or []
        assert ','.join(cache) == 'private, no-store', route
        assert 'cookie' in [item.strip().lower() for item in ','.join(vary).split(',')], route
        rows.append({'path': route, 'status': 401, 'privateNoStore': True, 'varyCookie': True, 'genericErrorOnly': True})

request = urllib.request.Request(origin + '/hr/settings', headers={'Cache-Control': 'no-cache'})
with urllib.request.urlopen(request, timeout=25) as response:
    assert response.status == 200
    html = response.read(1024 * 1024 + 1)
    assert len(html) <= 1024 * 1024
urls = sorted(set(html_parser.unescape(url) for url in re.findall(r'(?:src|href)="(/_next/static/[^"<>]+\.js(?:\?[^"<>]*)?)"', html.decode('utf-8'))))
assert urls and len(urls) <= 100
for url in urls:
    parsed = urllib.parse.urlsplit(url)
    assert not parsed.scheme and not parsed.netloc and parsed.path.startswith('/_next/static/') and parsed.path.endswith('.js')
    assert urllib.parse.parse_qs(parsed.query).get('dpl') == [marker], 'Every referenced JS must target this exact production deployment'
chunks = []
total = 0
for url in urls:
    with urllib.request.urlopen(origin + url, timeout=25) as response:
        assert response.status == 200
        body = response.read(4 * 1024 * 1024 + 1)
        assert len(body) <= 4 * 1024 * 1024
    total += len(body)
    assert total <= 20 * 1024 * 1024
    chunks.append(body.decode('utf-8'))
bundle = '\n'.join(chunks)
markers = ['/api/hr/department-operation?operationId=', 'hr-department-create-intent:v1:', '作成結果を確認する', '同じ内容で作成を再開する', '未受付の操作を終了する', '認証情報を確認しています。', '招待リンクをコピーできませんでした。']
assert all(value in bundle for value in markers), 'The published settings page must include durable creation, auth-scope gating and truthful clipboard recovery'
result = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'commit': commit, 'deployment': marker, 'passed': True, 'routes': rows,
    'settingsPageStatus': 200, 'referencedJsChunks': len(urls), 'jsBytes': total, 'clientMarkers': markers,
    'scope': 'Inherited17-service/static/SEO/banner/cache/org-chart public checks and exact deployment identity, plus anonymous durable operation GET private401 and the current public page referenced JavaScript markers. No authenticated customer operation, production DB writes, real OAuth or provider generation. Browser interaction and authenticated data paths require separate synthetic native/actualNext proofs; full17service2074criterion original188 plus new operation GET =189 audit remains active.',
}
(base / 'hr-department-operation-public.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False))
