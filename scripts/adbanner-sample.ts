// 広告バナー サンプル生成（gpt-image-2 medium）。実プロンプトで3サイズ生成し /tmp に保存。
import fs from 'fs'
import path from 'path'
import { loadEnv } from './_env'
async function main() {
  loadEnv()
  const sharp = (await import('sharp')).default
  const { generateImageWithFallback } = await import('../src/lib/image-generator')
  // gptSizeFor は本番パイプライン(generate.ts)と同一ロジックを使う（サイズ対応がズレないように）。
  const { gptSizeFor } = await import('../src/lib/adbanner/generate')
  const { buildBannerPrompt } = await import('../src/lib/adbanner/prompts')
  const { findSize } = await import('../src/lib/adbanner/types')
  const outDir = '/tmp/adbanner-samples'
  fs.mkdirSync(outDir, { recursive: true })

  const targets = ['1080x1080', '1200x628', '1080x1920'] // スクエア / 横長(以前失敗) / 縦長
  // 3サイズは独立しているので並列生成（直列だと合計約2〜3分、並列なら最長1枚分で済む）。
  await Promise.all(targets.map(async (key) => {
    const sz = findSize(key)!
    const { size: gptSize, aspect } = gptSizeFor(sz.w, sz.h)
    const prompt = buildBannerPrompt({
      serviceName: 'ドヤAIO', appeal: 'AIに選ばれる', appealAxis: 'ベネフィット訴求',
      tone: '明るくポップ', brandColors: ['#7f19e6', '#e879f9'], media: 'meta',
      aspect, hasLogo: false,
    } as any)
    const t0 = Date.now()
    const res = await generateImageWithFallback({ prompt, size: gptSize, quality: 'medium' })
    const raw = Buffer.from(res.base64, 'base64')
    const buf = await sharp(raw).resize(sz.w, sz.h, { fit: 'cover' }).png().toBuffer()
    const file = path.join(outDir, `${key}.png`)
    fs.writeFileSync(file, buf)
    console.log(`${key}: ${Math.round((Date.now() - t0) / 1000)}秒 model=${res.model} fallbackUsed=${res.fallbackUsed} -> ${file}`)
  }))
}
main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(1) })
