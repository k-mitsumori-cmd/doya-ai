// 実行: npx tsx --test src/lib/brand/brand.test.ts
// サービス名の切り替え（ドヤAI → ドヤバディ）の旗と、名前の関数の回帰テスト。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandRenameRollout, isBrandRenamed } from './flag'
import { brandAlternateNames, brandName, brandNameEn, brandNameWithFormer, brandText } from './index'

test('旗: all だけが切り替え。値が無い・空・知らない値は off（旗のテストは undefined ではなく空を渡す）', () => {
  assert.equal(brandRenameRollout('all'), 'all')
  assert.equal(brandRenameRollout(' ALL '), 'all')
  for (const v of ['', 'off', 'preview', 'true', '1', undefined]) assert.equal(brandRenameRollout(v as string), 'off')
  assert.equal(isBrandRenamed('all'), true)
  assert.equal(isBrandRenamed(''), false)
})

test('名前: 旗が off なら今のまま、all ならドヤバディ（旧ドヤAI を併記できる）', () => {
  assert.equal(brandName(false), 'ドヤAI')
  assert.equal(brandName(true), 'ドヤバディ')
  assert.equal(brandNameEn(false), 'DOYA AI')
  assert.equal(brandNameEn(true), 'DOYA BUDDY')
  assert.equal(brandNameWithFormer(false), 'ドヤAI')
  assert.equal(brandNameWithFormer(true), 'ドヤバディ（旧ドヤAI）')
  assert.deepEqual(brandAlternateNames(false), [])
  assert.ok(brandAlternateNames(true).includes('ドヤAI'))
  assert.ok(brandAlternateNames(true).includes('DOYA AI'))
})

test('文の置き換え: サービス名だけを変え、ツールの名前・URL の識別名は変えない。旗が off なら一切変えない', () => {
  const s = 'ドヤAIに頼む。ドヤAIは、ドヤAIOとドヤAI質問リンクとドヤAI商談とドヤバナーを束ねます。https://doya-ai.surisuta.jp'
  assert.equal(brandText(s, false), s)
  assert.equal(
    brandText(s, true),
    'ドヤバディに頼む。ドヤバディは、ドヤAIOとドヤAI質問リンクとドヤAI商談とドヤバナーを束ねます。https://doya-ai.surisuta.jp',
  )
  assert.equal(brandText('', true), '')
  assert.equal(brandText('ドヤAI', true), 'ドヤバディ')
})

test('旗が off（既定）の間は、サイト名・トップのタイトル・別名が、いまの表示のまま', async () => {
  const { SITE_CONFIG, SERVICE_SEO, SITE_ALTERNATE_NAMES } = await import('../seo')
  assert.equal(SITE_CONFIG.name, 'ドヤAI')
  assert.equal(SITE_CONFIG.tagline, 'ドヤAIのサービス群')
  assert.equal(SERVICE_SEO.portal.title, 'ドヤAI | AI SaaSサービス群')
  assert.ok(SERVICE_SEO.portal.description.startsWith('ドヤAIは、'))
  assert.equal(SERVICE_SEO.portal.keywords[0], 'ドヤAI')
  assert.equal(SITE_ALTERNATE_NAMES[0], 'ドヤマーケAI')
})
