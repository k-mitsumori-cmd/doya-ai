import sys, subprocess, pathlib, json, urllib.request, urllib.error, re, datetime

base = pathlib.Path(__file__).parent
marker, commit = sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+', marker) and re.fullmatch(r'[a-f0-9]{40}', commit)
# Retain the full inherited public checks, including exact deployment identity.
subprocess.run(['python3', str(base / 'verify-hr-kintai-additional-cache-public.py'), marker, commit], check=True)
origin = 'https://doya-ai.surisuta.jp'
rows = []
for route in ['/api/hr/org-chart?format=pages', '/api/hr/org-chart?format=pages&cursor=invalid']:
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

request = urllib.request.Request(origin + '/hr/org-chart', headers={'Cache-Control': 'no-cache'})
with urllib.request.urlopen(request, timeout=25) as response:
    assert response.status == 200
    html = response.read(1024 * 1024 + 1)
    assert len(html) <= 1024 * 1024
urls = sorted(set(re.findall(r'(?:src|href)="(/_next/static/[^"<>]+\.js)"', html.decode('utf-8'))))
assert urls and len(urls) <= 100
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
markers = ['/api/hr/org-chart?format=pages', 'hr-org-chart-page-v1', 'さらに', '取得中に組織図が更新されました']
assert all(value in bundle for value in markers), 'The published org-chart page must include the new paged client and recovery UI'
result = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'commit': commit, 'deployment': marker, 'passed': True, 'routes': rows,
    'orgChartPageStatus': 200, 'referencedJsChunks': len(urls), 'jsBytes': total, 'clientMarkers': markers,
    'scope': 'Inherited17-service/static/SEO/banner/cache public checks and exact deployment identity, plus anonymous paged GET private401 and the current public page referenced JavaScript markers. No authenticated customer operation, production DB writes, real OAuth or provider generation. Browser interaction and authenticated data paths require separate synthetic native/actualNext proofs; full17service2074criterion188GET audit remains active.',
}
(base / 'hr-org-chart-pagination-public.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False))
