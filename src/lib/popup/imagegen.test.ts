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

test('新しく作るときの「画像でデザインした版」は、画像の無い画像型の下書き（この時点で課金しない）', async () => {
  const { imageDraftProposal } = await import('./proposals')
  const p = imageDraftProposal({ ...SITE, contactUrl: 'https://example.com/contact', downloadUrl: null, pricingUrl: null, pages: [], colors: [] } as any)
  assert.equal(p.kind, 'image')
  assert.equal(p.creative.imagePath, null)
  assert.equal(p.creative.buttonUrl, 'https://example.com/contact')
  const src = readFileSync(join(process.cwd(), 'src/lib/popup/propose.ts'), 'utf8')
  assert.ok(/withImageDraft === true/.test(src))
  assert.ok(!/generatePopupImage|generateImageWithFallback/.test(src), '提案の作成では画像を作らない')
})

test('失敗のとき、回数とドヤパワーを戻すかを種類ごとに決める', async () => {
  const { generateAndSave } = await import('./imagegen')
  const input = { site: SITE, brief: { headline: '', message: '' }, colors: COLORS, layout: 'slide' as PopupLayout }
  const okSave = async () => ({ path: 'a/b/c.webp', width: 1024, height: 1024 })
  const okGen = (async () => ({ base64: await fakePng(1024, 1024), mimeType: 'image/png', model: 'gpt-image-2', fallbackUsed: false })) as any
  const run = (generate: any, save: any = okSave) => generateAndSave({ generate, save }, input)

  const done = await run(okGen)
  assert.equal(done.ok, true)

  // 上流が失敗を返した（status が数）: 作られていない → 回数を戻す・ドヤパワーも戻す（印なし）
  const up: any = await run((async () => { throw Object.assign(new Error('x'), { status: 500 }) }) as any)
  assert.deepEqual([up.ok, up.refundQuota, up.consumed], [false, true, false])
  // 応答は返ったが画像が無い: 課金された → 回数は戻す・ドヤパワーは戻さない
  const none: any = await run((async () => { throw new Error('Gemini returned no image') }) as any)
  assert.deepEqual([none.refundQuota, none.consumed], [true, true])
  // 時間切れ・切断: 作られたか分からない → どちらも戻さない
  const timeout: any = await run((async () => { throw new Error('request timeout') }) as any)
  assert.deepEqual([timeout.refundQuota, timeout.consumed], [false, true])
  // 作れたあとの失敗（大きすぎる）: 課金された → どちらも戻さない
  const noise = (await sharp({ create: { width: 3000, height: 3000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 90 } } } as any).png().toBuffer()).toString('base64')
  const big: any = await run((async () => ({ base64: noise, mimeType: 'image/png', model: 'm', fallbackUsed: false })) as any)
  assert.deepEqual([big.ok, big.refundQuota, big.consumed], [false, false, true])
  // 作れたあとの失敗（保存できない・保存が例外）: どちらも戻さない
  const noSave: any = await run(okGen, async () => ({ error: 'x' }))
  assert.deepEqual([noSave.ok, noSave.refundQuota, noSave.consumed], [false, false, true])
  const throwSave: any = await run(okGen, async () => { throw new Error('storage down') })
  assert.deepEqual([throwSave.refundQuota, throwSave.consumed], [false, true])
})

test('API の入口: 回数を戻すのは generateAndSave が refundQuota と言ったときだけ。課金後の失敗には印を付ける', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/popup/popups/[id]/image/generate/route.ts'), 'utf8')
  assert.equal((src.match(/refundDailyQuota\(/g) || []).length, 1) // 呼び出しは if (r.refundQuota) の1か所だけ
  assert.ok(/if \(r\.refundQuota\) await refundDailyQuota/.test(src))
  assert.ok(/if \(r\.consumed\) res\.headers\.set\(DOYA_POWER_CONSUMED_HEADER/.test(src))
  assert.ok(!/catch \(e\)[\s\S]*refundDailyQuota/.test(src), 'catch の中で回数を戻さない')
})
