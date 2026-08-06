// 調査用: ドヤ商談準備の生成済みスライド画像を1枚取得し、寸法と「上部が切れていないか」を確認する。
// 使い方: npx tsx scripts/shodan-inspect-slide.ts [出力ディレクトリ]
import { loadEnv } from './_env'
loadEnv()

import fs from 'fs'
import path from 'path'

async function main() {
  const outDir = process.argv[2] || '/tmp'
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const { signedUrl } = await import('../src/lib/shodan/storage')

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, "targetName", "slideImages", "updatedAt"
     FROM shodan_preparations
     WHERE "slideImages" IS NOT NULL
     ORDER BY "updatedAt" DESC
     LIMIT 3`
  )
  console.log('見つかった準備:', rows.length)

  for (const r of rows) {
    const imgs = (r.slideImages || []) as any[]
    console.log(`\n=== ${r.id} / ${r.targetName} / スライド${imgs.length}枚 / ${r.updatedAt} ===`)
    for (let i = 0; i < imgs.length; i++) {
      const p = imgs[i]?.imagePath || imgs[i]?.imageUrl
      if (!p || String(p).startsWith('http')) { console.log(`  ${i}: パス無し（${JSON.stringify(imgs[i]).slice(0, 120)}）`); continue }
      const url = await signedUrl(p, 600)
      if (!url) { console.log(`  ${i}: 署名URL取得失敗 ${p}`); continue }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      const file = path.join(outDir, `slide-${r.id.slice(0, 6)}-${i}.png`)
      fs.writeFileSync(file, buf)
      const sharp = (await import('sharp')).default
      const meta = await sharp(buf).metadata()
      console.log(`  ${i}: ${meta.width}x${meta.height} (${(meta.width! / meta.height!).toFixed(3)}) ${(buf.length / 1024).toFixed(0)}KB -> ${file}`)
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
