import sys, subprocess, pathlib, json, urllib.request, urllib.parse, re, datetime, concurrent.futures

base = pathlib.Path(__file__).parent
marker, commit = sys.argv[1:3]
assert re.fullmatch(r'dpl_[a-zA-Z0-9]+', marker) and re.fullmatch(r'[a-f0-9]{40}', commit)
subprocess.run(['python3', str(base/'verify-banner-scope-public.py'), marker, commit], check=True)
origin = 'https://doya-ai.surisuta.jp'
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=25) as r:
        body = r.read(4000001)
        assert len(body) <= 4000000
        return r.status, body.decode('utf-8'), r.url

status, html, final = get(origin+'/seo/template')
assert status == 200 and marker in html and final == origin+'/seo/template'
urls = sorted({urllib.parse.urljoin(origin, u.replace('&amp;', '&')) for u in re.findall(r'<script[^>]+src="([^"]+)"', html)})
assert urls and all(urllib.parse.urlparse(u).netloc == 'doya-ai.surisuta.jp' and '/_next/static/' in u for u in urls)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    assets = list(pool.map(get, urls))
assert all(a[0] == 200 for a in assets)
code = '\n'.join(a[1] for a in assets)
checks = {text: text in code for text in [
    '認証情報を確認しています。',
    'ログイン情報を確認できません。',
    'タイトル生成中に条件が変わりました。新しい条件でもう一度お試しください。',
    '二重作成を避けるため、記事一覧で保存状況をご確認ください。',
    '記事は保存済みです。下のリンクから作成済みの記事を開いてください。',
    '作成済みの記事を開く',
    '["bannerPlan","seoPlan","kantanPlan","interviewPlan","openingPlan","doyalistPlan","kintaiPlan"]',
]}
assert all(checks.values()), checks
with urllib.request.urlopen(urllib.request.Request(origin+'/api/seo/entitlements', headers={'Cache-Control':'no-cache'}), timeout=25) as r:
    raw = r.read(4097)
    assert len(raw) <= 4096
    quota = json.loads(raw)
    headers = {k.lower(): ', '.join(r.headers.get_all(k, [])) for k in r.headers.keys()}
    assert r.status == 200 and quota.get('isLoggedIn') is False and quota.get('plan') == 'GUEST'
    assert headers.get('cache-control') == 'private, no-store' and 'cookie' in [v.strip().lower() for v in headers.get('vary','').split(',')]
    private_cache = {'status':r.status,'isLoggedIn':False,'privateNoStore':True,'varyCookie':True}
report = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'commit': commit, 'deployment': marker, 'passed': True,
    'page': '/seo/template', 'status': status, 'assetCount': len(assets), 'markers': checks, 'anonymousEntitlementCache': private_cache,
    'scope': 'Exact deployment marker, inherited17-service/static/banner/anonymous-role checks and SEO template compiled client guidance. Anonymous no-cookie entitlement GET only; source bootstrap verified read-only. No generation POST, OAuth, provider or production/customer DB writes. Actual authenticated lifecycle and durable ambiguous-create recovery remain unverified.',
}
(base/'seo-template-public.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(report, ensure_ascii=False))
