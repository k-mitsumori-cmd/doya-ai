// ブースのデザインの決まり（BDK）と、面の画像の切り出しの確かめ。課金 API・DB は使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_INPUT, analyzeSite, generateBoothPlans } from './engine'
import { generateGraphicPlan } from './graphics'
import { aspectOf, cropBox, cutFractions, grayFrameInset, safeZone } from './image-fit'
import { HEADLINE_MAX_PER_LINE, buildDesignPrompt, checkKit, contrast, deriveKit, headlineLines, isHex, kitBlock, saturation, withPaletteColor } from './design-kit'

test('主色は、白い見出しが読める暗さ（対比 4.5 以上）に整える。同じ色相のまま暗くする', () => {
  const kit = deriveKit({ colors: { primary: '#ffd23f', secondary: '#1f1414', accent: '#0f62fe' }, tone: 't' })
  assert.ok(contrast(kit.palette.primary, '#ffffff') >= 4.5)
  assert.equal(kit.provenance.primary.from, 'derived')
  assert.ok(checkKit(kit).every((r) => r.ok), JSON.stringify(checkKit(kit)))
})

test('黒・白・灰色に近い主色は、差し色を主色にする。主色と見分けのつかない差し色は、既定の黄色にする', () => {
  const kit = deriveKit({ colors: { primary: '#222222', secondary: '#111111', accent: '#e5484d' }, tone: 't' })
  assert.ok(saturation(kit.palette.primary) >= 0.2)
  assert.equal(kit.palette.accent, '#ffd400')
  const same = deriveKit({ colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#0a60f0' }, tone: 't' })
  assert.equal(same.palette.accent, '#ffd400')
})

test('暗色は、明るい色が来ても、主色を暗くして作る（白との対比 12 以上）', () => {
  const kit = deriveKit({ colors: { primary: '#0066ff', secondary: '#cccccc', accent: '#ffd400' }, tone: 't' })
  assert.ok(contrast(kit.palette.dark, '#ffffff') >= 12)
  assert.equal(kit.provenance.dark.from, 'derived')
})

test('決まりの色は、5つの役割の #rrggbb だけ。直した色は出どころが user になる', () => {
  const kit = deriveKit(analyzeSite(SAMPLE_INPUT.serviceUrl))
  for (const v of Object.values(kit.palette)) assert.ok(isHex(v), v)
  assert.equal(Object.keys(kit.palette).length, 5)
  const edited = withPaletteColor(kit, 'accent', '#00aa55')
  assert.equal(edited.palette.accent, '#00aa55')
  assert.equal(edited.provenance.accent.from, 'user')
  assert.equal(withPaletteColor(kit, 'accent', 'red').palette.accent, kit.palette.accent)
  const ratioSum = Object.values(kit.ratio).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(ratioSum - 1) < 1e-9)
})

test('3つの案は、面積の比率が違うが、色の5つの役割は同じ', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const band = deriveKit(a, 'band'), paper = deriveKit(a, 'paper'), dark = deriveKit(a, 'dark')
  assert.deepEqual(band.palette, paper.palette)
  assert.deepEqual(paper.palette, dark.palette)
  assert.notEqual(kitBlock(band), kitBlock(paper))
  assert.notEqual(kitBlock(paper), kitBlock(dark))
})

test('見出しは、1行 12 字・2行まで。改行があればそれを使う。長いときは真ん中で分ける', () => {
  assert.deepEqual(headlineLines('導入が早い'), ['導入が早い'])
  assert.deepEqual(headlineLines('マーケの作業、\nAIでドヤ速。'), ['マーケの作業、', 'AIでドヤ速。'])
  const long = headlineLines('ITに詳しくなくても迷わない画面です')
  assert.equal(long.length, 2)
  assert.ok(long.every((l) => [...l].length <= HEADLINE_MAX_PER_LINE))
  assert.equal(headlineLines('あ'.repeat(40)).join('').length, 24)
  assert.deepEqual(headlineLines(''), [])
})

test('全部の面と制作物の指示文に、同じ決まりのブロックが一字も違わずに入る。見出しは引用符で入る', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const kit = deriveKit(a)
  const block = kitBlock(kit)
  const panels = generateGraphicPlan(generateBoothPlans(SAMPLE_INPUT)[0], a)
  assert.ok(panels.length > 1)
  for (const [i, p] of panels.entries()) {
    const prompt = buildDesignPrompt(kit, { name: p.name, widthMm: p.widthMm, heightMm: p.heightMm, role: p.role, layout: i === 0 ? 'hero' : 'appeal', headline: p.headline })
    assert.ok(prompt.includes(block), p.name)
    if (p.headline) for (const l of headlineLines(p.headline)) assert.ok(prompt.includes(`「${l}」`), l)
  }
  const none = buildDesignPrompt(kit, { name: 'x', widthMm: 100, heightMm: 100, role: 'r', layout: 'guide', headline: '' })
  assert.match(none, /文字・数字・ロゴ・記号を、一切描かない/)
  const ref = buildDesignPrompt(kit, { name: 'x', widthMm: 100, heightMm: 100, role: 'r', layout: 'guide', headline: 'あ', hasReference: true })
  assert.match(ref, /添付の画像は、このブースの見本/)
})

test('切り出し: 面の実寸の縦横比に、中央から切る。切られる量を先に計算する', () => {
  // 背面壁の中央（6000×2700mm）を 21:9 で作ると、上下が少し切られる
  const wall = cropBox(2688, 1152, 6000 / 2700)
  assert.ok(Math.abs(wall.sw / wall.sh - 6000 / 2700) < 0.01)
  // ロールアップ（850×2000）を 9:16 で作ると、左右が各 12% ほど切られる
  const f = cutFractions('9:16', 850 / 2000)
  assert.ok(f.x > 0.11 && f.x < 0.13 && f.y === 0, JSON.stringify(f))
  const z = safeZone('9:16', 850 / 2000)
  assert.ok(z.safeWidthPct >= 70 && z.safeWidthPct <= 76 && z.safeHeightPct === 100, JSON.stringify(z))
  // 近い比率は、切らない
  assert.deepEqual(safeZone('3:4', 2000 / 2700), { safeWidthPct: 100, safeHeightPct: 100 })
  assert.deepEqual(cropBox(1536, 2048, aspectOf('3:4')), { sx: 0, sy: 0, sw: 1536, sh: 2048 })
  // 切った結果は、元の画像の中に収まる
  const b = cropBox(1000, 1000, 0.5)
  assert.ok(b.sx >= 0 && b.sx + b.sw <= 1000 && b.sh === 1000)
})

test('指示文に、寸法（mm）や割合（%）の数字を書かない（画像に寸法線や注釈が描かれるため。2026-10-29 の試しで分かった）', () => {
  const kit = deriveKit({ colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400' }, tone: '親しみやすく、自信がある' })
  for (const [w, h] of [[2000, 2700], [850, 2000], [6000, 2700], [210, 297]] as const) {
    const prompt = buildDesignPrompt(kit, { name: 'x', widthMm: w, heightMm: h, role: '役割', viewDistanceM: 5, layout: 'hero', headline: '導入が早い', hasReference: true, safeWidthPct: 76, safeHeightPct: 100 })
    assert.doesNotMatch(prompt, /\d\s*mm/, `${w}x${h}`)
    assert.doesNotMatch(prompt, /\d\s*%/, `${w}x${h}`)
  }
  assert.match(buildDesignPrompt(kit, { name: 'x', widthMm: 850, heightMm: 2000, role: 'r', layout: 'appeal', headline: 'あ' }), /縦に細長い長方形/)
})

test('灰色の額縁（台紙）を見つける。白い下の帯や、紺の円は、額縁とみなさない', () => {
  const w = 100, h = 140
  const make = (frame: boolean) => {
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inside = x >= 8 && x < w - 8 && y >= 8 && y < h - 8
      let c: [number, number, number] = [255, 255, 255] // 紙
      if (y >= 8 && y < 50) c = [0, 102, 255] // 主色の帯
      if (x > 50 && x < 90 && y > 80 && y < 110) c = [10, 15, 60] // 紺の円
      if (frame && !inside) c = [95, 95, 95] // 灰色の台紙
      ;[px[i], px[i + 1], px[i + 2], px[i + 3]] = [c[0], c[1], c[2], 255]
    }
    return px
  }
  const f = grayFrameInset(make(true), w, h)
  assert.ok(f.top > 0.05 && f.left > 0.05 && f.bottom > 0.05 && f.right > 0.05, JSON.stringify(f))
  assert.ok(f.top < 0.2 && f.left < 0.2)
  assert.deepEqual(grayFrameInset(make(false), w, h), { top: 0, right: 0, bottom: 0, left: 0 })
})
