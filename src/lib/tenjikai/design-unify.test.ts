// 展示会の面の画像の統一感（2026-10-27 ユーザーの指摘「面ごとにばらばら・文字が崩れる・重なる」）の回帰テスト。
// 課金 API・DB は使わない。git・docs・reference も読まない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SAMPLE_INPUT, analyzeSite, generateBoothPlans } from './engine'
import { boothDesignRules, buildPanelPrompt, generateGraphicPlan } from './graphics'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

test('全部の面の指示文に、同じデザインの決まりが入る', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const plan = generateBoothPlans(SAMPLE_INPUT)[0]
  const panels = generateGraphicPlan(plan, a)
  assert.ok(panels.length > 1)
  const rules = boothDesignRules(a)
  for (const p of panels) assert.ok(buildPanelPrompt(p, a).includes(rules), p.name)
  assert.ok(rules.includes(a.colors.primary) && rules.includes(a.colors.accent))
})

test('画像に文字を描かせない（見出しは画面の側で重ねる）', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const p = generateGraphicPlan(generateBoothPlans(SAMPLE_INPUT)[0], a)[0]
  const prompt = buildPanelPrompt(p, a)
  assert.match(prompt, /文字・数字・ロゴ・記号・認証マーク・QR コードは、一切描かない/)
  assert.doesNotMatch(prompt, /日本語は正確に/)
  const art = read('src/components/tenjikai/Booth3D.tsx')
  assert.match(art, /<span className="line-clamp-2 font-black[^"]*"[^>]*>\{p\.headline \|\| a\.brand\}<\/span>/)
})

test('3D の面は、部材の高さいっぱいに引き伸ばさず、床からの位置と高さで置く', () => {
  const art = read('src/components/tenjikai/Booth3D.tsx')
  assert.match(art, /const panelTop = Math\.max\(0, h - \(\(p\.baseMm \+ p\.heightMm\) \/ 1000\) \* S\)/)
  assert.doesNotMatch(art, /className="absolute top-0 h-full overflow-hidden"/)
})

test('制作物スタジオは、作る前に仮の絵を出さず、名前と大きさの枠にする', () => {
  const studio = read('src/components/tenjikai/CreativeStudio.tsx')
  assert.match(studio, /data-wireframe="creative"/)
  assert.doesNotMatch(studio, /: <CreativePreview c=\{c\} a=\{analysis\} \/>\}/)
})
