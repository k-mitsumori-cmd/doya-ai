// 広告バナー量産パイプライン end-to-end 検証（横長サイズが gpt-image-2 で出るか）
import { loadEnv } from './_env'
async function main() {
  loadEnv()
  const { generateBanners } = await import('../src/lib/adbanner/generate')
  const t0 = Date.now()
  const creatives = await generateBanners({
    campaignId: 'pipeline-test',
    serviceName: 'ドヤAIO',
    appeal: 'AIに選ばれる',
    brandColors: ['#7f19e6', '#e879f9'],
    media: 'google',
    sizes: ['1200x628', '728x90'], // 以前失敗していた横長サイズ
    variants: 2,
    logo: null,
  })
  const sec = Math.round((Date.now() - t0) / 1000)
  console.log(`\n生成 ${creatives.length}/2 枚  所要${sec}秒`)
  creatives.forEach((c) => console.log(`  size=${c.size}  model=${c.model}  path=${c.imagePath}`))
}
main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(1) })
