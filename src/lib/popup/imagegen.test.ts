// 画像生成の単体テスト。生成の関数は偽物に差し替える（課金の API は呼ばない）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  buildImagePrompt,
  generatePopupImage,
  parseImageBrief,
  popupImageSize,
  POPUP_IMAGE_DAILY_LIMIT,
  POPUP_IMAGE_QUALITY,
  POPUP_IMAGE_SIZES,
  IMAGE_BRIEF_LIMITS,
} from './imagegen'
import { detectImageType } from './storage'
import type { PopupLayout } from './schema'

const COLORS = { bg: '#ffffff', accent: '#0066ff', text: '#1f2430' }
const SITE = { name: 'テスト社', summary: '中小企業向けの勤怠管理サービス', target: '人事担当者', strengths: ['導入が早い', '安い'] }

async function fakePng(w = 1024, h = 1280): Promise<string> {
  const buf = await sharp({ create: { width: w, height: h, channels: 3, background: '#0066ff' } }).png().toBuffer()
  return buf.toString('base64')
}

test('大きさは16の倍数・3:1以内・1024×1024以上の面積で、縦横比がポップアップに合う', () => {
  for (const [layout, s] of Object.entries(POPUP_IMAGE_SIZES)) {
    assert.equal(s.width % 16, 0, layout)
    assert.equal(s.height % 16, 0, layout)
    assert.ok(Math.max(s.width / s.height, s.height / s.width) <= 3, layout)
    assert.ok(s.width * s.height >= 1024 * 1024, layout)
  }
  assert.equal(popupImageSize('slide').size, '1024x1024')
  assert.ok(popupImageSize('modal').height > popupImageSize('modal').width)
  assert.ok(popupImageSize('bar').width > popupImageSize('bar').height)
})

test('入力の検査: 長すぎる見出し・伝えたいことは断る。制御文字は落とす', () => {
  assert.equal(parseImageBrief({ headline: 'あ'.repeat(IMAGE_BRIEF_LIMITS.headline + 1) }).ok, false)
  assert.equal(parseImageBrief({ message: 'あ'.repeat(IMAGE_BRIEF_LIMITS.message + 1) }).ok, false)
  const r = parseImageBrief({ headline: ' 無料\u0000相談 ', message: '安心\n感を出す' })
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.brief.headline, '無料相談')
    assert.equal(r.brief.message, '安心 感を出す')
  }
  assert.ok(parseImageBrief(null).ok)
})

test('指示文: 見出しは1つだけ・ロゴや人物は描かせない・色とサイトの内容が入る', () => {
  const p = buildImagePrompt({ site: SITE, brief: { headline: '無料相談', message: '安心感' }, colors: COLORS, layout: 'modal' })
  assert.ok(p.includes('「無料相談」'))
  assert.ok(p.includes('見出し1つだけ'))
  assert.ok(p.includes('ロゴ'))
  assert.ok(p.includes('実在の人物'))
  assert.ok(p.includes('#0066ff'))
  assert.ok(p.includes('勤怠管理'))
  assert.ok(p.includes('1024×1280'))
  const none = buildImagePrompt({ site: SITE, brief: { headline: '', message: '' }, colors: COLORS, layout: 'slide' })
  assert.ok(none.includes('文字は一切描かない'))
  assert.ok(!/「/.test(none.split('【文字】')[1]))
})

test('生成: size と quality を必ず明示して1回だけ呼び、WebP（2MB以内）にして返す', async () => {
  const calls: any[] = []
  const generate = (async (req: any) => {
    calls.push(req)
    return { base64: await fakePng(), mimeType: 'image/png', model: 'gpt-image-2', fallbackUsed: false }
  }) as any
  for (const layout of ['modal', 'slide', 'bar'] as PopupLayout[]) {
    calls.length = 0
    const r = await generatePopupImage({ generate }, { site: SITE, brief: { headline: '無料相談', message: '' }, colors: COLORS, layout })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].size, popupImageSize(layout).size)
    assert.equal(calls[0].quality, POPUP_IMAGE_QUALITY)
    assert.equal(calls[0].quality, 'medium')
    assert.ok(calls[0].aspectRatio)
    assert.equal(calls[0].inputImages, undefined)
    assert.ok(r.ok)
    if (r.ok) {
      assert.equal(detectImageType(r.image), 'image/webp')
      assert.ok(r.image.length <= 2 * 1024 * 1024)
    }
  }
})

test('生成: 上流の失敗はそのまま例外にする（課金の戻しは呼び出し元）', async () => {
  const generate = (async () => {
    throw Object.assign(new Error('boom'), { status: 500 })
  }) as any
  await assert.rejects(generatePopupImage({ generate }, { site: SITE, brief: { headline: '', message: '' }, colors: COLORS, layout: 'modal' }), /boom/)
})

test('1日の上限は10回', () => {
  assert.equal(POPUP_IMAGE_DAILY_LIMIT, 10)
})

test('API の入口: ログイン・持ち主・画像型・課金・上限・統一ディスパッチャ', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/popup/popups/[id]/image/generate/route.ts'), 'utf8')
  assert.ok(/getPopupUserId\(\)/.test(src) && /ownPopup\(userId, id\)/.test(src))
  assert.ok(/popup\.kind !== 'image'/.test(src))
  assert.ok(/export const POST = withDoyaPowerCharge\(/.test(src) && /action: 'popup\.image'/.test(src))
  assert.ok(/consumeDailyQuota\(/.test(src))
  assert.ok(/generateImageWithFallback/.test(src))
  // 禁止のモデルと、画像 API の直接呼び出しを使わない
  assert.ok(!/imagen|dall-e|gemini-2|nano-banana['"]|images\.generate|api\.openai\.com/i.test(src))
  const lib = readFileSync(join(process.cwd(), 'src/lib/popup/imagegen.ts'), 'utf8')
  assert.ok(/quality: POPUP_IMAGE_QUALITY/.test(lib) && /size,/.test(lib))
})
