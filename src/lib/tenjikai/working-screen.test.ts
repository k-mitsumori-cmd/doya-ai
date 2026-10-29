// 待ち画面（ドヤくんが壁を塗る。2026-10-29 ユーザー「待ち時間にも遊び心を」）の回帰テスト。
// 課金 API・DB は使わない。git・docs・reference も読まない（Vercel のビルドには無い）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

test('画像を作っている間の画面は、ドヤくんの待ち画面を出し、ブランドの色を渡す', () => {
  const modal = read('src/components/tenjikai/ImageGenModal.tsx')
  assert.match(modal, /busy \? \(\s*<DoyaWorking[^>]*colors=\{colors\}/)
  const batch = read('src/components/tenjikai/BoothStudio.tsx')
  // 塗る色は、確定したブースのデザインの決まり（kit）の色（2026-10-29 から。サイトの解析の色そのものではない）
  assert.match(batch, /<DoyaWorking[\s\S]*colors=\{\{ primary: kit\.palette\.primary, secondary: kit\.palette\.dark, accent: kit\.palette\.accent \}\}[\s\S]*progress=\{/)
  assert.match(read('src/components/tenjikai/CreativeStudio.tsx'), /colors=\{\{ primary: kit\.palette\.primary, secondary: kit\.palette\.dark, accent: kit\.palette\.accent \}\}/)
})

test('待ち画面は、動きを減らす設定で止まり、絵の入れ替えは位置・濃さだけで動かす', () => {
  const css = read('src/components/shell/DoyaWorking.module.css')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  // レイアウトを動かさない（top・left・width・height のアニメーションを使わない）。@keyframes の波かっこを数えて、1つぶんの中身を取り出す
  const names = [...css.matchAll(/@keyframes ([\w-]+) \{/g)]
  assert.ok(names.length >= 6)
  for (const m of names) {
    let i = (m.index ?? 0) + m[0].length
    let depth = 1
    const start = i
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    assert.doesNotMatch(css.slice(start, i - 1), /\b(top|left|right|bottom|width|height|margin)\s*:/, m[1])
  }
})

test('待ち画面の絵の3枚が置いてある', () => {
  for (const f of ['paint-a', 'paint-b', 'paint-done']) assert.ok(existsSync(join(process.cwd(), `public/character/${f}-512.webp`)), f)
})

test('塗る色は、16進の6桁だけを受け取り、それ以外は既定の色にする', () => {
  const src = read('src/components/shell/DoyaWorking.tsx')
  assert.match(src, /const HEX = \/\^#\[0-9a-fA-F\]\{6\}\$\//)
  assert.match(src, /pick\(colors\?\.primary, DEFAULT_COLORS\.primary\)/)
})
