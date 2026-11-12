// ブースのデザインの決まり（BDK）と、面の画像の切り出しの確かめ。課金 API・DB は使わない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_INPUT, analyzeSite, generateBoothPlans, mockGeneratedPlan } from './engine'
import { generateGraphicPlan } from './graphics'
import { ART_TYPES, HEADLINE_MAX_PER_LINE, buildDesignPrompt, checkKit, completeDirections, completeStrategy, contrast, deriveKit, draftDirections, draftStrategy, headlineLines, isHex, isKit, kitBlock, readKit, saturation, scrub, withDirection, withPaletteColor, type LayoutType } from './design-kit'

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

const A = analyzeSite(SAMPLE_INPUT.serviceUrl)
const kitOf = (type: (typeof ART_TYPES)[number]) => withDirection(deriveKit(A), draftDirections(A).find((d) => d.type === type)!)

test('3つの方向（実写・大きな文字と色面・世界観）の指示文は、互いに違う。色の5つの役割は同じ', () => {
  const [photo, graphic, world] = (['photo', 'graphic', 'world'] as const).map(kitOf)
  assert.deepEqual(photo.palette, graphic.palette)
  const blocks = [kitBlock(photo), kitBlock(graphic), kitBlock(world)]
  assert.equal(new Set(blocks).size, 3)
  for (const layout of ['hero', 'appeal', 'number', 'guide'] as LayoutType[]) {
    const prompts = [photo, graphic, world].map((k) => buildDesignPrompt(k, { name: 'x', widthMm: 2000, heightMm: 2700, role: 'r', layout, headline: '導入が早い' }))
    assert.equal(new Set(prompts).size, 3, layout)
  }
  // 型ごとの言葉（構図・光・素材）
  assert.match(blocks[0], /自然光/)
  assert.match(blocks[0], /被写界深度は浅く/)
  assert.match(blocks[2], /リムライト/)
  // 「帯1本・円1つ」の文は、大きな文字と色面の型にだけ残る
  assert.match(blocks[1], /帯は1本だけ/)
  assert.doesNotMatch(blocks[0], /帯は1本だけ/)
  assert.doesNotMatch(blocks[2], /帯は1本だけ/)
})

test('どの型の指示文にも、見出しの決まり（1つだけ・引用符）と、禁止（実在の人物・ロゴ・額縁・寸法の数字）が入る', () => {
  for (const type of ART_TYPES) {
    const kit = kitOf(type)
    const prompt = buildDesignPrompt(kit, { name: 'x', widthMm: 2000, heightMm: 2700, role: 'r', layout: 'hero', headline: 'マーケの作業、\nAIでドヤ速。', hasReference: true })
    assert.match(prompt, /この面に描く文字は、次の1つだけ。一字も変えず、一字も足さず、正確に描く/, type)
    assert.ok(prompt.includes('「マーケの作業、」') && prompt.includes('「AIでドヤ速。」'), type)
    assert.match(prompt, /【禁止】/)
    assert.match(prompt, /実在する人物/, type)
    assert.match(prompt, /ロゴや認証マーク/, type)
    assert.match(prompt, /枠・額縁・外側の余白・背景の灰色/, type)
    assert.match(prompt, /寸法線と寸法・割合の数字/, type)
    assert.match(prompt, /添付の画像は、このブースの見本/, type)
    assert.doesNotMatch(prompt, /\d\s*mm/, type)
    assert.doesNotMatch(prompt, /\d\s*%/, type)
  }
})

test('方向の題材・狙いに、引用符や数字と単位があっても、指示文には入らない', () => {
  const dirty = withDirection(deriveKit(A), { ...draftDirections(A)[0], subject: '「大きな見出し」と2000mmの壁、85%の人', aim: '導入率90%' })
  const block = kitBlock(dirty)
  assert.doesNotMatch(block, /[「」]/)
  assert.doesNotMatch(block, /\d\s*(mm|%)/)
  assert.equal(scrub('「あ」12mm'), 'あ')
})

test('version 1 の保存は、graphic として読む。壊れた保存は読まない', () => {
  const v2 = deriveKit(A)
  const { direction: _d, ...rest } = v2
  const v1 = { ...rest, version: 1 }
  assert.equal(isKit(v1), false)
  const read = readKit(v1)
  assert.equal(read?.version, 2)
  assert.equal(read?.direction.type, 'graphic')
  assert.equal(readKit(v2)?.direction.type, 'graphic')
  assert.equal(readKit({ ...v2, direction: { type: 'oil' } }), null)
  assert.equal(readKit({ version: 3 }), null)
  assert.equal(readKit(null), null)
  const photo = kitOf('photo')
  assert.equal(readKit(JSON.parse(JSON.stringify(photo)))?.direction.type, 'photo')
})

test('方向の下書きは、型が3つそろう。AI の返事が欠けても、項目ごとに下書きで埋まる', () => {
  const draft = draftDirections(A, 'demo')
  assert.deepEqual(draft.map((d) => d.type).sort(), ['graphic', 'photo', 'world'])
  assert.ok(draft.every((d) => d.name && d.aim && d.subject && d.headline))
  const out = completeDirections([{ type: 'world', name: 'AI の名前', aim: '', subject: 5, headline: 'あ'.repeat(40) }, { type: 'bogus', name: 'x' }], draft)
  assert.equal(out.length, 3)
  assert.equal(out.find((d) => d.type === 'world')!.name, 'AI の名前')
  assert.equal(out.find((d) => d.type === 'world')!.aim, draft.find((d) => d.type === 'world')!.aim)
  assert.equal(out.find((d) => d.type === 'world')!.subject, draft.find((d) => d.type === 'world')!.subject)
  assert.ok(headlineLines(out.find((d) => d.type === 'world')!.headline).every((l) => [...l].length <= HEADLINE_MAX_PER_LINE))
  assert.deepEqual(out.find((d) => d.type === 'photo'), draft.find((d) => d.type === 'photo'))
  assert.equal(completeDirections(null, draft).length, 3)
  assert.equal(completeDirections({ photo: { name: 'P' } }, draft).find((d) => d.type === 'photo')!.name, 'P')
  const st = draftStrategy(A, 'lead')
  assert.deepEqual(completeStrategy({ aim: 'A', hook: 5 }, st), { ...st, aim: 'A' })
  assert.ok(Object.values(st).every(Boolean))
})

test('下書きの計画（mock）にも、戦略と、3つの型の方向が入る', () => {
  const g = mockGeneratedPlan(SAMPLE_INPUT)
  assert.ok(g.strategy && Object.values(g.strategy).every(Boolean))
  assert.deepEqual(g.directions?.map((d) => d.type).sort(), ['graphic', 'photo', 'world'])
})
