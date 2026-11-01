#!/usr/bin/env python3
"""旗が off のとき、出力が main と1文字も変わらないことを、2つの開発サーバーの HTML を比べて確かめる。

使い方:
  1) main の checkout で   npx next dev -p 3495          （比べる元）
  2) この枝で、旗を付けずに npx next dev -p 3494          （旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT は未設定）
  3) python3 scripts/brand/compare-flag-off.py [3494] [3495]
- ビルドごとに変わる値（チャンク名・ハッシュ・日時）は、比べる前に取り除く。
- 比べるページ: トップ・利用規約・プライバシー・料金・robots・sitemap・llms.txt（画面・メタ情報・構造化データ）。
"""
import difflib
import re
import sys
import urllib.request

off, main = (sys.argv[1:3] + ['3494', '3495'][len(sys.argv[1:3]):])[:2]
PAGES = ['/', '/terms', '/privacy', '/pricing', '/robots.txt', '/sitemap.xml', '/llms.txt']


def get(port, path):
    with urllib.request.urlopen(f'http://localhost:{port}{path}', timeout=280) as r:
        return r.read().decode('utf-8', 'ignore')


def norm(s):
    s = re.sub(r'/_next/static/[^"\' )]+', '/_next/static/X', s)
    s = re.sub(r'"buildId":"[^"]*"', '"buildId":"X"', s)
    s = re.sub(r'dpl_[A-Za-z0-9]+', 'X', s)
    s = re.sub(r'\b[a-f0-9]{16,}\b', 'H', s)
    s = re.sub(r'_next/[^"\' ]+', 'N', s)
    s = re.sub(r'<script[^>]*>.*?</script>', lambda m: m.group(0) if 'ld+json' in m.group(0) else '<script/>', s, flags=re.S)
    s = re.sub(r'<lastmod>[^<]*</lastmod>', '', s)
    return s


bad = 0
for p in PAGES:
    a, b = norm(get(off, p)), norm(get(main, p))
    same = a == b
    print(f'{p:14} {len(a):6} {len(b):6}  {"同じ" if same else "違う"}')
    if not same:
        bad += 1
        for l in list(difflib.unified_diff(b.split('>'), a.split('>'), lineterm='', n=0))[:8]:
            print('   ', l[:140])
sys.exit(1 if bad else 0)
