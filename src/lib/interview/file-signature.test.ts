// 実行: npm run test:syscheck
// インタビュー素材の中身の検査（先頭のバイト）を確かめる（SEC-069）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesInterviewFileSignature as matches } from './file-signature'

const bytesOf = (...parts: Array<string | number[]>) => new Uint8Array(parts.flatMap((p) => typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))

test('音声・動画は、主なコンテナ形式を受け付ける', () => {
  assert.equal(matches('audio', 'audio/mpeg', bytesOf('ID3', [3, 0])), true)
  assert.equal(matches('audio', 'audio/mpeg', bytesOf([0xff, 0xfb, 0x90])), true)
  assert.equal(matches('audio', 'audio/wav', bytesOf('RIFF', [0, 0, 0, 0], 'WAVE')), true)
  assert.equal(matches('audio', 'audio/mp4', bytesOf([0, 0, 0, 0x20], 'ftypM4A ')), true)
  assert.equal(matches('video', 'video/quicktime', bytesOf([0, 0, 0, 0x14], 'ftypqt  ')), true)
  assert.equal(matches('video', 'video/webm', bytesOf([0x1a, 0x45, 0xdf, 0xa3])), true)
  assert.equal(matches('audio', 'audio/ogg', bytesOf('OggS')), true)
  assert.equal(matches('audio', 'audio/flac', bytesOf('fLaC')), true)
  assert.equal(matches('video', 'video/x-msvideo', bytesOf('RIFF', [0, 0, 0, 0], 'AVI ')), true)
})

test('音声と偽った別の形式は受け付けない', () => {
  assert.equal(matches('audio', 'audio/mpeg', bytesOf('<html><script>')), false)
  assert.equal(matches('audio', 'audio/wav', bytesOf('%PDF-1.7')), false)
  assert.equal(matches('video', 'video/mp4', bytesOf('MZ', [0x90, 0])), false)
  assert.equal(matches('audio', 'audio/mpeg', new Uint8Array()), false)
})

test('PDF・画像・テキストを判定する', () => {
  assert.equal(matches('pdf', 'application/pdf', bytesOf('%PDF-1.4')), true)
  assert.equal(matches('pdf', 'application/pdf', bytesOf([0xef, 0xbb, 0xbf], '%PDF-1.4')), true)
  assert.equal(matches('pdf', 'application/pdf', bytesOf('<html>')), false)
  assert.equal(matches('image', 'image/png', bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
  assert.equal(matches('image', 'image/jpeg', bytesOf([0xff, 0xd8, 0xff, 0xe0])), true)
  assert.equal(matches('image', 'image/webp', bytesOf('RIFF', [0, 0, 0, 0], 'WEBP')), true)
  assert.equal(matches('image', 'image/png', bytesOf('GIF89a')), false)
  assert.equal(matches('text', 'text/plain', bytesOf('インタビューの書き起こし')), true)
  assert.equal(matches('text', 'text/plain', bytesOf('abc', [0], 'def')), false)
  const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  assert.equal(matches('text', docx, bytesOf('PK', [3, 4])), true)
  assert.equal(matches('text', docx, bytesOf('plain text')), false)
})
