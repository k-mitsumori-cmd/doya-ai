// 実行: npm run test:syscheck
// クリック計測リンクが、署名の無い外部 URL へ転送しないことを確かめる（SEC-026）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClickLinkId, resolveClickLink, isTrustedLegacyHost } from './drip-click-link'

const legacy = (url: string) => Buffer.from(url).toString('base64url')

test('送信時に作った署名付きリンクは、元の URL へ転送する', () => {
  const id = createClickLinkId('track-1', 'https://example.com/lp?a=1')
  assert.deepEqual(resolveClickLink('track-1', id), { kind: 'signed', url: 'https://example.com/lp?a=1' })
})

test('別の trackingId で使い回した署名は拒否する', () => {
  const id = createClickLinkId('track-1', 'https://example.com/')
  assert.equal(resolveClickLink('track-2', id).kind, 'rejected')
})

test('URL を差し替えて署名だけ流用したリンクは拒否する', () => {
  const sig = createClickLinkId('track-1', 'https://example.com/').split('.')[1]
  assert.equal(resolveClickLink('track-1', `${legacy('https://evil.example/')}.${sig}`).kind, 'rejected')
})

test('署名の無い外部サイト宛てのリンクは拒否する（オープンリダイレクト対策）', () => {
  assert.equal(resolveClickLink('any', legacy('https://evil.example/')).kind, 'rejected')
  assert.equal(resolveClickLink('any', legacy('https://surisuta.jp.evil.example/')).kind, 'rejected')
  assert.equal(resolveClickLink('any', legacy('javascript:alert(1)')).kind, 'rejected')
})

test('署名の無い古いリンクでも、自社ドメインの https 宛てなら転送する（送信済みメールの互換）', () => {
  assert.deepEqual(resolveClickLink('any', legacy('https://doya-ai.surisuta.jp/banner')), { kind: 'legacy', url: 'https://doya-ai.surisuta.jp/banner' })
  assert.equal(isTrustedLegacyHost('http://doya-ai.surisuta.jp/'), false)
  assert.equal(isTrustedLegacyHost('https://surisuta.jp/'), true)
})

test('壊れた linkId は拒否する', () => {
  assert.equal(resolveClickLink('any', '%%%').kind, 'rejected')
  assert.equal(resolveClickLink('any', '').kind, 'rejected')
})
