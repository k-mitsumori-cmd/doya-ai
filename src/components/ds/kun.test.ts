// 実行: npx tsx --test src/components/ds/kun.test.ts
// ドヤくんの共通部品の、絵の選び方と動きの部品の回帰テスト。画面は描かない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { kunSrc, kunSrcSet } from './kun-src'
import { splitWords } from './split-words'

const CHAR = join(process.cwd(), 'public/character')

test('絵: ポーズごとに 512px の絵が実在する', () => {
  for (const f of readdirSync(CHAR).filter((n) => n.endsWith('-512.webp'))) {
    const pose = f.replace('-512.webp', '')
    assert.equal(kunSrc(pose as never), `/character/${pose}-512.webp`)
  }
  assert.equal(kunSrc('mascot:quote'), '/ui-renewal/mascots/quote.webp')
  assert.equal(kunSrc('mascot:../x'), '/ui-renewal/mascots/x.webp', '3D のクマの名前は英小文字と - だけ')
})

test('srcSet: 256px 版がある絵だけを切り替え、無い絵・3D のクマは出さない（存在しない絵を指さない）', () => {
  for (const f of readdirSync(CHAR).filter((n) => n.endsWith('-512.webp'))) {
    const pose = f.replace('-512.webp', '')
    const set = kunSrcSet(pose as never)
    const has256 = existsSync(join(CHAR, `${pose}-256.webp`))
    assert.equal(Boolean(set), has256, `${pose}: 256px 版の有無と srcSet が合う`)
    if (set) assert.equal(set, `/character/${pose}-256.webp 256w, /character/${pose}-512.webp 512w`)
  }
  assert.equal(kunSrcSet('mascot:quote'), undefined)
})

test('部品: 画像は遅らせて読み、デコードは非同期。選び直しで作り直さない key と、読み上げの文は1回だけ', () => {
  const kun = readFileSync(join(process.cwd(), 'src/components/ds/kun.tsx'), 'utf8')
  assert.match(kun, /loading="lazy"/)
  assert.match(kun, /decoding="async"/)
  const motion = readFileSync(join(process.cwd(), 'src/components/ds/motion.tsx'), 'utf8')
  const reveal = motion.slice(motion.indexOf('export function RevealWords'), motion.indexOf('export function splitWords'))
  assert.ok(!reveal.includes('aria-label'), 'aria-label を付けない（読み上げが空にならない）')
  assert.equal((reveal.match(/styles\.srOnly/g) ?? []).length, 1, '読み上げ用の文は1回だけ')
  assert.match(reveal, /aria-hidden="true"/)
  const page = readFileSync(join(process.cwd(), 'src/app/(shell)/shanai/new/page.tsx'), 'utf8')
  assert.match(page, /<DoyaKun key=\{m\.key\}/, 'key は m.key だけ（選び直しで登場の動きを繰り返さない）')
})

test('言葉の分け方: 句読点で区切り、長い塊は6文字ずつ。つなげると元の文に戻る', () => {
  const text = 'ドヤAIが、依頼を読んでいます。ツールと操作を選び、入力の直前まで進めます。'
  const words = splitWords(text)
  assert.equal(words.join(''), text)
  assert.ok(words.every((w) => w.length <= 8))
  assert.deepEqual(splitWords(''), [])
})
