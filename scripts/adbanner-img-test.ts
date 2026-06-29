// 広告バナー画像生成の切り分けテスト（gpt-image-2 → nano-banana フォールバック）
// 実行: AIO_ENV_FILE=/tmp/aio-scan.env npx tsx scripts/adbanner-img-test.ts
import { loadEnv } from './_env'

async function main() {
  loadEnv()
  const { generateImageWithFallback } = await import('../src/lib/image-generator')
  const prompt = 'A clean modern advertising banner for a SaaS service. Purple and white. Bold Japanese headline. Professional.'
  for (const size of ['1536x1024']) {
    process.stdout.write(`\n--- size=${size} (quality=medium) ---\n`)
    try {
      const t0 = Date.now()
      const r = await generateImageWithFallback({ prompt, size, quality: 'medium' })
      const sec = Math.round((Date.now() - t0) / 1000)
      console.log(`OK ${sec}秒 model=${r.model} fallbackUsed=${r.fallbackUsed} b64len=${r.base64.length}` + (r.primaryError ? `\n  primaryError=${r.primaryError.slice(0, 240)}` : ''))
    } catch (e: any) {
      console.log(`FAILED: ${(e?.message || e).slice(0, 400)}`)
    }
  }
}
main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(1) })
