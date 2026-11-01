#!/usr/bin/env python3
"""ドヤバディの OGP 画像・メールの見出し画像を作る（ひな形。ロゴは案1「ドヤ顔のバッジ」に決定（2026-10-31）。横長ロゴは public/brand/doya-buddy/logo/ の SVG をそのまま埋め込む）。

使い方: FONT_DIR=<書体のフォルダ> python3 scripts/brand/build-assets.py [出力フォルダ]
        node scripts/brand/render-logos.cjs <出力フォルダ> native     … SVG を PNG に書き出す
- 出力: <フォルダ>/ogp/portal.svg と ogp/<ツール>.svg（1200×630）、email/header.svg（1200×280。表示は幅 600px の 2 倍）
- 文字（サービス名・ツール名）は、書体の字形をパスにしたベクター。クマの絵は、いまの画像を埋め込む。
- ロゴ（クマ＋文字）は public/brand/doya-buddy/logo/doya-buddy-logo-horizontal-light.svg。旧案の PROPOSAL は使わない。
- 作った画像を本番に使うのは、切り替える日（本人の承認のあと）。public/ogp/ へ置き換えるときは、旧画像を git の履歴に残したまま、同じファイル名で上書きする。
有料の API は使わない。
"""
import base64
import importlib.util
import io
import os
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/design/brand/doya-buddy-assets'

spec = importlib.util.spec_from_file_location('build_logos', ROOT / 'scripts/brand/build-logos.py')
bl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bl)  # type: ignore[union-attr]
NAVY, BLUE = bl.NAVY, bl.BLUE

# ツール（public/ogp/<id>.jpg があるもの）の名前。正本は src/lib/services.ts
TOOLS = {
    'banner': 'ドヤバナーAI', 'seo': 'ドヤ記事作成', 'interview': 'ドヤインタビュー', 'persona': 'ドヤペルソナAI', 'hr': 'ドヤHR', 'kintai': 'ドヤ勤怠',
    'doyalist': 'ドヤリスト', 'promane': 'ドヤプロマネ', 'doyaslide': 'ドヤスライド', 'cunning': 'ドヤカンニング', 'sfa': 'ドヤ営業管理',
    'shodan': 'ドヤ商談準備', 'aio': 'ドヤAIO', 'mensetsu': 'ドヤ面接官', 'quote': 'ドヤ見積もりAI', 'aishodan': 'ドヤAI商談',
    'adimage': 'ドヤ広告画像AI', 'asklink': 'ドヤAI質問リンク', 'popup': 'ドヤポップアップ', 'tenjikai': 'ドヤ展示会', 'shanai': 'ドヤ社内インタビュー',
}


def png_b64(path: Path, size=None) -> str:
    im = Image.open(path).convert('RGBA')
    if size:
        im.thumbnail((size, size))
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def mascot(name: str) -> str:
    return png_b64(ROOT / f'public/ui-renewal/mascots/{name}.webp', 640)


def image(x: float, y: float, w: float, h: float, b64: str) -> str:
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{b64}"/>'


def label(text, x, y, size, color, font, track=0.0):
    d, w = bl.text_path(font, text, size, 0, 0, track)
    return f'<path transform="translate({x},{y})" d="{d}" fill="{color}"/>', w


def wrap_svg(w: int, h: int, body: str, bg: str, title: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title><rect width="{w}" height="{h}" fill="{bg}"/>{body}</svg>')


LOGO_SVG = (ROOT / 'public/brand/doya-buddy/logo/doya-buddy-logo-horizontal-light.svg').read_text(encoding='utf-8')
_m = re.match(r'<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>(.*)</svg>\s*$', LOGO_SVG, re.S)
LOGO_W, LOGO_H = float(_m.group(1)), float(_m.group(2))
LOGO_INNER = re.sub(r'<title>.*?</title>', '', _m.group(3), flags=re.S)


def logo_row(x, y, mark_size, jp_size=None):
    """新ロゴ（クマ＋ドヤバディ／DOYA BUDDY の横長）。mark_size は高さ。戻り値 = (SVG の部品, 全体の幅)"""
    k = mark_size / LOGO_H
    return f'<g transform="translate({x},{y}) scale({k})">{LOGO_INNER}</g>', LOGO_W * k


def portal() -> str:
    body, _ = logo_row(64, 60, 170)
    en = ''
    tag1, _ = label('AIで、ビジネスの', 64, 360, 50, NAVY, 'zen-maru-bold.ttf')
    tag2, _ = label('「ドヤれる」をつくる。', 64, 430, 50, BLUE, 'zen-maru-bold.ttf')
    chips = ''
    x = 64
    for t, c in (('記事生成', '#e4efff'), ('バナー作成', '#e0f7ef'), ('営業支援', '#ece8ff'), ('資料作成', '#ffe6ee')):
        d, w = bl.text_path('zen-maru-bold.ttf', t, 24, 0, 0, 0)
        chips += f'<rect x="{x}" y="490" width="{w + 40}" height="48" rx="24" fill="{c}"/><path transform="translate({x + 20},{490 + 33})" d="{d}" fill="{NAVY}"/>'
        x += w + 40 + 14
    return wrap_svg(1200, 630, body + en + tag1 + tag2 + chips + image(700, 30, 480, 570, mascot('growth-pro')), '#f3f8ff', bl.JP_FULL)


def tool(tid: str, name: str) -> str:
    body, _ = logo_row(64, 48, 84)
    d, w = bl.text_path('NotoSansJP-Black.ttf', name, 96 if len(name) <= 8 else 76, 0, 0, 0.0)
    size = 96 if len(name) <= 8 else 76
    title = f'<path transform="translate(64,330)" d="{d}" fill="{NAVY}"/>'
    sub, _ = label(bl.JP_FULL + 'のツール', 68, 410, 32, BLUE, 'zen-maru-bold.ttf', 0.04)
    m = ROOT / f'public/ui-renewal/mascots/{tid}.webp'
    art = image(700, 90, 460, 460, mascot(tid)) if m.exists() else ''
    return wrap_svg(1200, 630, body + title + sub + art, '#f3f8ff', f'{name}｜ドヤバディ')


def email_header() -> str:
    body, w = logo_row(60, 24, 192)
    return wrap_svg(1200, 240, body, '#ffffff', bl.JP_FULL)


def main() -> None:
    (OUT / 'ogp').mkdir(parents=True, exist_ok=True)
    (OUT / 'email').mkdir(parents=True, exist_ok=True)
    (OUT / 'ogp/portal.svg').write_text(portal(), encoding='utf-8')
    for tid, name in TOOLS.items():
        (OUT / f'ogp/{tid}.svg').write_text(tool(tid, name), encoding='utf-8')
    (OUT / 'email/header.svg').write_text(email_header(), encoding='utf-8')
    print('ogp', 1 + len(TOOLS), 'email 1')


if __name__ == '__main__':
    main()
