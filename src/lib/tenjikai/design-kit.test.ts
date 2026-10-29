// ブースのデザインの決まり（BDK）と、面の画像の切り出しの確かめ。課金 API・DB は使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_INPUT, analyzeSite, generateBoothPlans } from './engine'
import { generateGraphicPlan } from './graphics'
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

test('指示文に、寸法（mm）や割合（%）の数字を書かない（画像に寸法線や注釈が描かれるため。2026-10-29 の試しで分かった）', () => {
  const kit = deriveKit({ colors: { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400' }, tone: '親しみやすく、自信がある' })
  for (const [w, h] of [[2000, 2700], [850, 2000], [6000, 2700], [210, 297]] as const) {
    const prompt = buildDesignPrompt(kit, { name: 'x', widthMm: w, heightMm: h, role: '役割', viewDistanceM: 5, layout: 'hero', headline: '導入が早い', hasReference: true, safeWidthPct: 76, safeHeightPct: 100 })
    assert.doesNotMatch(prompt, /\d\s*mm/, `${w}x${h}`)
    assert.doesNotMatch(prompt, /\d\s*%/, `${w}x${h}`)
  }
  assert.match(buildDesignPrompt(kit, { name: 'x', widthMm: 850, heightMm: 2000, role: 'r', layout: 'appeal', headline: 'あ' }), /縦に細長い長方形/)
})
