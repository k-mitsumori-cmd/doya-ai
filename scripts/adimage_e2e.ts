import { loadEnv } from './_env'
loadEnv()
import fs from 'fs'
import sharp from 'sharp'
import { analyzeBrand } from '../src/lib/adimage/brand'
import { generateConcepts } from '../src/lib/adimage/copy'
import { buildImagePrompt } from '../src/lib/adimage/prompt'
import { verifyCreative, isAcceptable, retryHint } from '../src/lib/adimage/verify'
import { generateImageWithFallback } from '../src/lib/image-generator'
import { findPlacement } from '../src/lib/adimage/placements'
import { evaluateCreative } from '../src/lib/adimage/feedback'

const OUT = '/private/tmp/claude-501/-Users-mitsumori-katsuki/a56d5a1c-ea7b-43fd-a750-03577391e69e/scratchpad'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  console.log('=== 1. ブランド抽出 ===')
  const brand = await analyzeBrand('https://doya-ai.surisuta.jp')
  console.log('  名前:', brand.name)
  console.log('  配色:', brand.colors.join(' '))
  console.log('  トーン:', brand.tone)

  console.log('\n=== 2. コピー生成（文字数上限の遵守）===')
  const concepts = await generateConcepts({ brand, count: 2 })
  for (const c of concepts) {
    console.log(`  [${c.appealAxis}] 見出し「${c.copy.headline}」(${c.copy.headline.length}字) / サブ「${c.copy.sub}」(${c.copy.sub.length}字) / CTA「${c.copy.cta}」(${c.copy.cta.length}字)`)
  }
  const copy = concepts[0].copy

  // 最難関の 9:16 で検証する
  const placement = findPlacement('meta.story')!
  console.log(`\n=== 3. フルベイク生成 ${placement.genW}x${placement.genH}（9:16・最難関）===`)

  let directives: string[] = []
  let buf: Buffer | null = null
  let verify: any = null

  for (let attempt = 0; attempt <= 2; attempt++) {
    const prompt = buildImagePrompt({ brand, copy, tone: concepts[0].tone, placement, composition: 'vertical-stack', extraDirectives: directives })
    const t0 = Date.now()
    const res = await generateImageWithFallback({ prompt, size: `${placement.genW}x${placement.genH}`, quality: 'medium' })
    const raw = Buffer.from(res.base64, 'base64')
    const meta = await sharp(raw).metadata()
    console.log(`  [試行${attempt + 1}] ${res.model}${res.fallbackUsed ? '(fallback)' : ''} ${meta.width}x${meta.height} ${((Date.now() - t0) / 1000).toFixed(0)}秒`)
    console.log(`           要求サイズどおり: ${meta.width === placement.genW && meta.height === placement.genH ? 'はい' : `*** いいえ (${meta.width}x${meta.height}) ***`}`)
    buf = raw
    fs.writeFileSync(`${OUT}/adimage_gen_try${attempt + 1}.png`, raw)

    console.log('  === 4. 自動検査（OCR照合）===')
    verify = await verifyCreative({ pngBase64: raw.toString('base64'), copy, composition: 'vertical-stack' })
    console.log(`    読み取れた文字: ${verify.detectedText}`)
    console.log(`    指定文字が全部描けた: ${verify.ocrMatch ? 'はい' : '*** いいえ ***'}`)
    console.log(`    混入した文字: ${verify.extraText.length ? verify.extraText.join(' / ') : 'なし'}`)
    console.log(`    セーフエリア内: ${verify.safeAreaOk ? 'はい' : '*** いいえ ***'}`)
    console.log(`    判定: ${isAcceptable(verify) ? '合格' : '不合格 → 再生成'}`)
    if (isAcceptable(verify)) break
    if (attempt < 2) directives = [retryHint(verify, copy)]
  }

  console.log('\n=== 5. 実寸へ書き出し（縮小のみ・クロップなし）===')
  const out = await sharp(buf!).resize(placement.w, placement.h, { fit: 'fill' }).png().toBuffer()
  const om = await sharp(out).metadata()
  console.log(`  ${placement.genW}x${placement.genH} -> ${om.width}x${om.height}  目標(${placement.w}x${placement.h})と一致: ${om.width === placement.w && om.height === placement.h ? 'はい' : '*** いいえ ***'}`)
  const ratioIn = placement.genW / placement.genH, ratioOut = placement.w / placement.h
  console.log(`  比率 ${ratioIn.toFixed(4)} -> ${ratioOut.toFixed(4)}  歪み ${(Math.abs(ratioIn - ratioOut) / ratioIn * 100).toFixed(3)}%`)
  fs.writeFileSync(`${OUT}/adimage_final_${placement.w}x${placement.h}.png`, out)

  console.log('\n=== 6. Visionフィードバック（実画像を見て採点）===')
  const fb = await evaluateCreative({
    pngBase64: out.toString('base64'), copy, brandName: brand.name, placementName: placement.name,
  })
  console.log(`  視認性 ${fb.scores.visibility} / 訴求 ${fb.scores.appeal} / CTA ${fb.scores.cta} / 配置 ${fb.scores.fit} / ブランド ${fb.scores.brand} = 合計 ${fb.scores.total}`)
  console.log(`  総評: ${fb.advice}`)
  for (const d of fb.directives) console.log(`  改善案[${d.target}]: ${d.instruction}`)
  console.log(`\n出力: ${OUT}/adimage_final_${placement.w}x${placement.h}.png`)
}
main().catch((e) => { console.error('失敗:', e.message); process.exit(1) })
