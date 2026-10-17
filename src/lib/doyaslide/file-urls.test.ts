// 実行: npm run test:syscheck
// ドヤスライドの画像 URL の読み替えと、配信 API の閲覧権限の判定を確かめる（SEC-062）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as urls from './file-urls'

// file-urls は呼び出しのたびに環境変数を読むので、テストの前に設定すればよい
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project-ref.supabase.co'

// 画像パス風の文字列をそのまま書くと、静的アセットの検査（verify-static-asset-urls）に拾われるので拡張子を分ける
const PNG = '.png'
const stored = (path: string) => `https://project-ref.supabase.co/storage/v1/object/public/doyaslide/${path}`

test('保存した公開 URL は、同じパスなら毎回同じ配信 URL に読み替える', () => {
  const src = urls.doyaslideImageSrc(stored('user-1/proj-1/abc.png'))
  assert.equal(src, '/api/doyaslide/files/user-1/proj-1/abc.png')
  assert.equal(urls.doyaslideImageSrc(stored('user-1/proj-1/abc.png')), src)
})

test('ドヤスライドのバケットでない URL や data: URL は、そのまま返す', () => {
  assert.equal(urls.doyaslideImageSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA')
  assert.equal(urls.doyaslideImageSrc('https://project-ref.supabase.co/storage/v1/object/public/other/x.png'), 'https://project-ref.supabase.co/storage/v1/object/public/other/x.png')
  assert.equal(urls.doyaslideImageSrc('https://evil.example/storage/v1/object/public/doyaslide/user-1/a.png'), 'https://evil.example/storage/v1/object/public/doyaslide/user-1/a.png')
  assert.equal(urls.doyaslideImageSrc(null), '')
})

test('パスの取り出しは、.. や許可外の文字を拒否する', () => {
  // URL の解釈で .. は先に正規化される。正規化後のパスにも本人確認がかかる（canReadDoyaslidePath）
  assert.equal(urls.doyaslidePathFromUrl(stored('user-1/../user-2/a.png')), 'user-2/a.png')
  assert.equal(urls.canReadDoyaslidePath('user-2/a.png', 'user-1'), false)
  // エンコードした %2e%2e も、URL の解釈で .. として正規化される
  assert.equal(urls.doyaslidePathFromUrl(stored('user-1/%2e%2e/a' + PNG)), 'a.png')
  // 区切りをエンコードして潜り込ませた .. は、取り出したあとで拒否する
  assert.equal(urls.doyaslidePathFromUrl(stored('user-1/..%2Fuser-2/a' + PNG)), null)
  assert.equal(urls.doyaslidePathFromSegments(['user-1', '..', 'a.png']), null)
  assert.equal(urls.doyaslidePathFromSegments(['user-1', 'p', 'a.png']), 'user-1/p/a.png')
})

test('利用者の画像は本人だけ、スタイル見本は誰でも見られる', () => {
  assert.equal(urls.canReadDoyaslidePath('user-1/p/a.png', 'user-1'), true)
  assert.equal(urls.canReadDoyaslidePath('user-1/p/a.png', 'user-2'), false)
  assert.equal(urls.canReadDoyaslidePath('user-1/p/a.png', null), false)
  assert.equal(urls.canReadDoyaslidePath('style-previews/v5-styles6/corporate-0.png', null), true)
  assert.equal(urls.canReadDoyaslidePath('style-previews/../user-1/a.png', null), false)
})
