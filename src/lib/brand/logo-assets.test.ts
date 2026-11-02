// ロゴ・アイコン・OGP の差し替え（旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT）の確かめ。
// 旗が off の間は今の画像、all のときは新ロゴ（ドヤバディ）の画像を指すこと、指す先のファイルが実在することを確かめる。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { STATIC_OGP_IDS, staticOgpPath } from '../ogp'
import { isBrandRenamed } from './flag'

const pub = (p: string) => path.join(process.cwd(), 'public', p)

test('OGP: 旗に合わせて置き場が変わり、どの id も実在する', () => {
  const dir = isBrandRenamed() ? '/ogp-buddy/' : '/ogp/'
  for (const id of STATIC_OGP_IDS) {
    const p = staticOgpPath(id)
    assert.equal(p, `${dir}${id}.jpg`)
    assert.ok(fs.existsSync(pub(p as string)), `${p} が無い`)
  }
  assert.equal(staticOgpPath('no-such-tool'), null)
})

test('OGP: 旗 off の画像と all の画像が、どちらも全部そろっている（切り替えの日に片方が無い、を防ぐ）', () => {
  for (const id of STATIC_OGP_IDS) {
    assert.ok(fs.existsSync(pub(`ogp/${id}.jpg`)), `ogp/${id}.jpg`)
    assert.ok(fs.existsSync(pub(`ogp-buddy/${id}.jpg`)), `ogp-buddy/${id}.jpg`)
  }
})

test('アイコン: 旗 off 用に移した画像と、新ロゴのアイコン類が実在する', () => {
  for (const f of [
    'brand/doya-ai-icon.png', 'brand/doya-ai-apple-icon.png',
    'brand/doya-buddy/favicon/favicon.ico', 'brand/doya-buddy/favicon/favicon.svg', 'brand/doya-buddy/favicon/favicon-32.png',
    'brand/doya-buddy/icon/doya-buddy-icon-64.png', 'brand/doya-buddy/icon/doya-buddy-icon-128.png', 'brand/doya-buddy/icon/doya-buddy-icon-180.png',
    'brand/doya-buddy/icon/doya-buddy-icon-192.png', 'brand/doya-buddy/icon/doya-buddy-icon-512.png', 'brand/doya-buddy/icon/doya-buddy-icon-1024.png',
  ]) assert.ok(fs.existsSync(pub(f)), f)
})

test('マニフェスト: 新しい方は名前がドヤバディで、指すアイコンが実在する', () => {
  const m = JSON.parse(fs.readFileSync(pub('site-buddy.webmanifest'), 'utf8'))
  assert.equal(m.name, 'ドヤバディ')
  assert.equal(m.short_name, 'ドヤバディ')
  for (const i of m.icons) assert.ok(fs.existsSync(pub(i.src.replace(/^\//, ''))), i.src)
  const old = JSON.parse(fs.readFileSync(pub('site.webmanifest'), 'utf8'))
  assert.ok(old.icons.length > 0)
})
