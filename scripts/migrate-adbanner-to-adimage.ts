// ============================================
// /adbanner → /adimage データ移行
// ============================================
// ⚠️ 冪等。既に移行済みのキャンペーンは飛ばす（何度流しても増えない）。
// ⚠️ 元データ（adbanner_*）は消さない。ロールバックの余地を残す。
// ⚠️ guestId だけのデータは移行しない。Cookie が一致しないため、
//    移行しても本人が到達できず、他人の画面に出る危険すらある。
//
// 使い方: npx tsx scripts/migrate-adbanner-to-adimage.ts [--apply]
//         引数なしは下見（dry-run）。--apply で実際に書き込む。
import { loadEnv } from './_env'
loadEnv()

import { PrismaClient } from '@prisma/client'
import { downloadBuffer as downloadAdbanner } from '../src/lib/adbanner/storage'
import { uploadPng } from '../src/lib/adimage/storage'
import { findPlacement, PLACEMENTS } from '../src/lib/adimage/placements'

const apply = process.argv.includes('--apply')
const prisma = new PrismaClient()

/** adbanner の "1080x1080" 等から、いちばん近い adimage の配置を選ぶ */
function guessPlacement(size: string) {
  const [w, h] = size.split('x').map(Number)
  if (!w || !h) return findPlacement('meta.feed_square')!
  const ratio = w / h
  let best = PLACEMENTS[0]
  let diff = Infinity
  for (const p of PLACEMENTS) {
    const d = Math.abs(p.w / p.h - ratio)
    if (d < diff) { diff = d; best = p }
  }
  return best
}

async function main() {
  console.log(apply ? '=== 実行モード（書き込みます）===' : '=== 下見モード（書き込みません）===')

  const campaigns = await prisma.adBannerCampaign.findMany({
    include: { banners: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`adbanner キャンペーン: ${campaigns.length}件`)

  let migrated = 0, skippedGuest = 0, skippedDone = 0, images = 0, imageFailed = 0

  for (const c of campaigns) {
    if (!c.userId) {
      // ⚠️ guestId のみ＝Cookieが一致しないと到達できない。移行しても本人に届かない
      skippedGuest++
      console.log(`  skip(ゲスト) ${c.name}`)
      continue
    }

    // 冪等性: 同じ sourceUrl + userId で既に作っていれば飛ばす
    const exists = await prisma.adImageBrand.findFirst({
      where: { userId: c.userId, sourceUrl: c.sourceUrl ?? undefined, name: c.serviceName || c.name },
      select: { id: true },
    })
    if (exists) { skippedDone++; console.log(`  skip(移行済み) ${c.name}`); continue }

    console.log(`  移行: ${c.name}（バナー${c.banners.length}件）`)
    if (!apply) { migrated++; continue }

    const brand = await prisma.adImageBrand.create({
      data: {
        userId: c.userId,
        name: (c.serviceName || c.name).slice(0, 200),
        sourceUrl: c.sourceUrl,
        colors: (c.brandColors ?? ['#0066ff']) as any,
        logoPath: null, // ⚠️ バケットが違うので引き継がない。必要なら再アップロードしてもらう
      },
    })
    const campaign = await prisma.adImageCampaign.create({
      data: {
        brandId: brand.id,
        userId: c.userId,
        name: c.name.slice(0, 200),
        appeal: c.appeal,
        placements: [] as any,
      },
    })

    for (const b of c.banners) {
      const pl = guessPlacement(b.size)
      // 画像はバケットが違うので実体をコピーする（参照だけ移すと表示できない）
      let newPath: string | null = null
      try {
        const buf = await downloadAdbanner(b.imagePath)
        if (buf) {
          newPath = `${c.userId}/${campaign.id}/migrated_${b.id}.png`
          await uploadPng(newPath, buf)
          images++
        }
      } catch {
        imageFailed++
      }
      if (!newPath) { imageFailed++; continue }

      await prisma.adImageConcept.create({
        data: {
          campaignId: campaign.id,
          label: b.variantLabel || '（旧ドヤ広告バナーAIからの移行）',
          appealAxis: 'benefit',
          tone: '',
          // ⚠️ 旧データにコピーの構造が無いため空にする。
          //    再生成すると別の絵になるので、画像はそのまま持ち越す。
          copy: { headline: '', sub: '', cta: '' } as any,
          compositionKey: pl.composition,
          genPaths: {} as any,
          visualPrompt: b.prompt,
          model: b.model,
          generation: b.generation,
          creatives: {
            create: [{
              placementKey: pl.key,
              size: b.size,
              genSize: b.size,
              compositionKey: pl.composition,
              imagePath: newPath,
              inspect: b.feedback as any,
            }],
          },
        },
      })
    }
    migrated++
  }

  console.log('\n=== 結果 ===')
  console.log(`  移行${apply ? '' : '予定'}: ${migrated}件`)
  console.log(`  skip（ゲスト・到達不能）: ${skippedGuest}件`)
  console.log(`  skip（移行済み）: ${skippedDone}件`)
  if (apply) console.log(`  画像コピー: 成功${images}件 / 失敗${imageFailed}件`)
  if (!apply) console.log('\n実際に移行するには --apply を付けて実行してください。')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('失敗:', e.message); await prisma.$disconnect(); process.exit(1) })
