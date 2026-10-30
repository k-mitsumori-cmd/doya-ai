#!/usr/bin/env python3
"""ドヤ部下の OGP 画像・メールの見出し画像を作る（ひな形。ロゴが決まったら、設定の PROPOSAL を差し替えて作り直す）。

使い方: FONT_DIR=<書体のフォルダ> python3 scripts/brand/build-assets.py [出力フォルダ]
        node scripts/brand/render-logos.cjs <出力フォルダ> native     … SVG を PNG に書き出す
- 出力: <フォルダ>/ogp/portal.svg と ogp/<ツール>.svg（1200×630）、email/header.svg（1200×280。表示は幅 600px の 2 倍）
- 文字（サービス名・ツール名）は、書体の字形をパスにしたベクター。クマの絵は、いまの画像を埋め込む。
- 仮の案は、build-logos.py の PROPOSAL（既定 'a' = 案A ふっくら丸ゴ）。ロゴが選ばれたら PROPOSAL を変える。
- 作った画像を本番に使うのは、切り替える日（本人の承認のあと）。public/ogp/ へ置き換えるときは、旧画像を git の履歴に残したまま、同じファイル名で上書きする。
有料の API は使わない。
"""
import base64
import importlib.util
import io
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'docs/design/brand/doya-buka-assets'
PROPOSAL = os.environ.get('BRAND_PROPOSAL', 'a')

spec = importlib.util.spec_from_file_location('build_logos', ROOT / 'scripts/brand/build-logos.py')
bl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bl)  # type: ignore[union-attr]
P = bl.PROPOSALS[PROPOSAL]
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


def logo_row(x, y, mark_size, jp_size):
    """クマのマーク + 「ドヤ部下」（2色）。戻り値 = (SVG の部品, 全体の幅)"""
    parts = [image(x, y, mark_size, mark_size, bl.MARK)]
    tx = x + mark_size + jp_size * 0.28
    base = y + mark_size / 2 + jp_size * 0.34
    d1, w1 = bl.text_path(P['jp'], bl.JP1, jp_size, 0, 0, P['jp_track'])
    d2, w2 = bl.text_path(P['jp'], bl.JP2, jp_size, 0, 0, P['jp_track'])
    gap = jp_size * 0.04
    parts.append(f'<path transform="translate({tx},{base})" d="{d1}" fill="{P["c1"]}"/>')
    parts.append(f'<path transform="translate({tx + w1 + gap},{base})" d="{d2}" fill="{P["c2"]}"/>')
    return ''.join(parts), (tx + w1 + gap + w2) - x


def portal() -> str:
    body, _ = logo_row(64, 70, 120, 112)
    en, _ = label(bl.EN_FULL, 70, 250, 30, BLUE, P['en'], 0.2)
    tag1, _ = label('AIで、ビジネスの', 64, 360, 50, NAVY, P['en'] if False else 'zen-maru-bold.ttf')
    tag2, _ = label('「ドヤれる」をつくる。', 64, 430, 50, BLUE, 'zen-maru-bold.ttf')
    chips = ''
    x = 64
    for t, c in (('記事生成', '#e4efff'), ('バナー作成', '#e0f7ef'), ('営業支援', '#ece8ff'), ('資料作成', '#ffe6ee')):
        d, w = bl.text_path('zen-maru-bold.ttf', t, 24, 0, 0, 0)
        chips += f'<rect x="{x}" y="490" width="{w + 40}" height="48" rx="24" fill="{c}"/><path transform="translate({x + 20},{490 + 33})" d="{d}" fill="{NAVY}"/>'
        x += w + 40 + 14
    return wrap_svg(1200, 630, body + en + tag1 + tag2 + chips + image(700, 30, 480, 570, mascot('growth-pro')), '#f3f8ff', bl.JP_FULL)


def tool(tid: str, name: str) -> str:
    body, _ = logo_row(64, 56, 64, 52)
    d, w = bl.text_path(P['jp'], name, 96 if len(name) <= 8 else 76, 0, 0, 0.0)
    size = 96 if len(name) <= 8 else 76
    title = f'<path transform="translate(64,330)" d="{d}" fill="{NAVY}"/>'
    sub, _ = label(bl.JP_FULL + 'のツール', 68, 400, 32, BLUE, 'zen-maru-bold.ttf', 0.04)
    m = ROOT / f'public/ui-renewal/mascots/{tid}.webp'
    art = image(700, 90, 460, 460, mascot(tid)) if m.exists() else ''
    return wrap_svg(1200, 630, body + title + sub + art, '#f3f8ff', f'{name}｜ドヤ部下')


def email_header() -> str:
    body, w = logo_row(60, 40, 160, 120)
    return wrap_svg(1200, 240, body, '#ffffff', bl.JP_FULL)


def main() -> None:
    (OUT / 'ogp').mkdir(parents=True, exist_ok=True)
    (OUT / 'email').mkdir(parents=True, exist_ok=True)
    (OUT / 'ogp/portal.svg').write_text(portal(), encoding='utf-8')
    for tid, name in TOOLS.items():
        (OUT / f'ogp/{tid}.svg').write_text(tool(tid, name), encoding='utf-8')
    (OUT / 'email/header.svg').write_text(email_header(), encoding='utf-8')
    print('ogp', 1 + len(TOOLS), 'email 1', '案', PROPOSAL)


if __name__ == '__main__':
    main()
