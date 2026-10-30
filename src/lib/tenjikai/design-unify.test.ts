// 展示会の面の画像の統一感（2026-10-27 ユーザーの指摘「面ごとにばらばら・文字が崩れる・重なる」、2026-10-29 の指摘「文字も含めた完成品の画像に」）の回帰テスト。
// 課金 API・DB は使わない。git・docs・reference も読まない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SAMPLE_INPUT, analyzeSite, generateBoothPlans, generateCreatives } from './engine'
import { boothDesignRules, buildPanelPrompt, generateGraphicPlan } from './graphics'
import { buildBoothRenderPrompt, buildCreativePrompt } from './imagegen'
import { deriveKit, kitBlock } from './design-kit'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

test('全部の面・全部の制作物・完成予想図の指示文に、同じデザインの決まりが入る', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const kit = deriveKit(a)
  const rules = boothDesignRules(a, kit)
  assert.equal(rules, kitBlock(kit))
  const plan = generateBoothPlans(SAMPLE_INPUT)[0]
  const panels = generateGraphicPlan(plan, a)
  assert.ok(panels.length > 1)
  for (const p of panels) assert.ok(buildPanelPrompt(p, a, kit).includes(rules), p.name)
  const creatives = generateCreatives(a, SAMPLE_INPUT)
  assert.equal(creatives.length, 6)
  for (const c of creatives) assert.ok(buildCreativePrompt(c, a, kit).includes(rules), c.kind)
  assert.ok(buildBoothRenderPrompt(plan, a, kit).includes(rules))
  assert.ok(rules.includes(kit.palette.primary) && rules.includes(kit.palette.accent) && rules.includes(kit.palette.dark))
})

test('画像に描く文字は、確定した見出しだけ（一字も足さない）。文字を描かせない面は、そのように書く', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const kit = deriveKit(a)
  const p = generateGraphicPlan(generateBoothPlans(SAMPLE_INPUT)[0], a)[0]
  const prompt = buildPanelPrompt(p, a, kit)
  assert.match(prompt, /この面に描く文字は、次の1つだけ。一字も変えず、一字も足さず、正確に描く/)
  assert.match(prompt, /文字に見える模様は、画面に1つも描かない/)
  // 制作物の、これまでの「日本語の文字は正確に」の頼み方は使わない
  const flyer = generateCreatives(a, SAMPLE_INPUT).find((c) => c.kind === 'card')!
  assert.match(buildCreativePrompt(flyer, a, kit), /文字・数字・ロゴ・記号を、一切描かない/)
  assert.doesNotMatch(read('src/lib/tenjikai/imagegen.ts'), /日本語の文字は正確に/)
})

test('面の画像の指示文には、切られても文字が残る幅が入る（細長い面）', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const kit = deriveKit(a)
  const rollup = generateGraphicPlan(generateBoothPlans(SAMPLE_INPUT).find((p) => p.elements.some((e) => e.kind === 'rollup'))!, a).find((p) => p.name === 'ロールアップバナー')
  if (!rollup) return
  assert.match(buildPanelPrompt(rollup, a, kit), /面の中央の約\d割の幅の中に置く/)
})

test('3D の面は、画像に文字を重ねない。部材の高さいっぱいに引き伸ばさず、床からの位置と高さで置く', () => {
  const art = read('src/components/tenjikai/Booth3D.tsx')
  assert.doesNotMatch(art, /color: '#fff' \}\}>\s*<span className="line-clamp-2/)
  assert.doesNotMatch(art, /line-clamp-/)
  assert.match(art, /const panelTop = Math\.max\(0, h - \(\(p\.baseMm \+ p\.heightMm\) \/ 1000\) \* S\)/)
  assert.doesNotMatch(art, /className="absolute top-0 h-full overflow-hidden"/)
  // モニターの文字は、出し入れしない（動きの途中で薄い灰色の字が残らないように）
  assert.doesNotMatch(art, /animate=\{\{ opacity: \[0, 1, 1, 0\] \}\}/)
})

test('制作物スタジオは、作る前に仮の絵を出さず、名前と大きさの枠にする', () => {
  const studio = read('src/components/tenjikai/CreativeStudio.tsx')
  assert.match(studio, /data-wireframe="creative"/)
  assert.doesNotMatch(studio, /: <CreativePreview c=\{c\} a=\{analysis\} \/>\}/)
})

test('文字を含まない昔の画像だけ、見出しを重ねる（暗い帯の上の白い字。切らずに縮める）。新しい画像には重ねない', () => {
  const art = read('src/components/tenjikai/Booth3D.tsx')
  assert.match(art, /const headline = legacy && !compact \? p\.headline \|\| a\.brand : ''/)
  assert.match(art, /linear-gradient\(rgba\(10,15,60,\.62\), rgba\(10,15,60,0\)\)/)
  assert.match(art, /legacy=\{isLegacyImage\(legacySig, p\.id, images\[p\.id\]\)\}/)
  assert.doesNotMatch(art, /line-clamp-/)
})

test('細長い枠（ロールアップ）の仮の枠は、縦書きで折り返し、左右が切れない', () => {
  const studio = read('src/components/tenjikai/CreativeStudio.tsx')
  assert.match(studio, /ratio < 0\.6 \? [^\n]*\[writing-mode:vertical-rl\]/)
  assert.match(studio, /\[overflow-wrap:anywhere\]/)
})
