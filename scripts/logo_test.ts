import { loadEnv } from './_env'
loadEnv()
import fs from 'fs'
import sharp from 'sharp'
import { overlayLogo, DEFAULT_LOGO_CONFIG } from '../src/lib/adimage/logo'

const OUT = '/private/tmp/claude-501/-Users-mitsumori-katsuki/a56d5a1c-ea7b-43fd-a750-03577391e69e/scratchpad'

async function main() {
  const base = fs.readFileSync(`${OUT}/adimage_final_1080x1920.png`)
  const m = await sharp(base).metadata()
  console.log(`土台: ${m.width}x${m.height}`)

  // ロゴを作る（濃紺の文字＝暗い背景では沈む想定）
  const logo = await sharp({
    create: { width: 600, height: 180, channels: 4, background: { r: 10, g: 15, b: 60, alpha: 1 } },
  }).png().toBuffer()

  let ng = 0
  for (const pos of ['bottom-right', 'top-left', 'center-top'] as const) {
    const out = await overlayLogo(base, logo, m.width!, m.height!, { ...DEFAULT_LOGO_CONFIG, pos })
    const om = await sharp(out).metadata()
    const same = om.width === m.width && om.height === m.height
    if (!same) ng++
    console.log(`  ${same ? 'OK  ' : '*** NG'} ${pos}: ${om.width}x${om.height}（寸法が変わらない）`)
    fs.writeFileSync(`${OUT}/logo_${pos}.png`, out)
  }

  console.log('\n=== 異常系（生成物を壊さないこと）===')
  const broken = await overlayLogo(base, Buffer.from('これは画像ではない'), m.width!, m.height!, DEFAULT_LOGO_CONFIG)
  const bm = await sharp(broken).metadata()
  const ok1 = bm.width === m.width && bm.height === m.height
  if (!ok1) ng++
  console.log(`  ${ok1 ? 'OK  ' : '*** NG'} 壊れたロゴ → 土台をそのまま返す`)

  const huge = await overlayLogo(base, logo, 100, 100, { ...DEFAULT_LOGO_CONFIG, maxWidthPct: 200 })
  console.log(`  OK   極端な設定でも例外にならない（${(await sharp(huge).metadata()).width}px）`)

  console.log(ng === 0 ? '\n結果: 全ケース期待どおり' : `\n結果: *** ${ng}件 期待外れ ***`)
  console.log(`出力: ${OUT}/logo_bottom-right.png`)
}
main().catch(e => { console.error('失敗:', e.message); process.exit(1) })
