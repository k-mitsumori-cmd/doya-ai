// ============================================
// 既存テンプレート画像を Postgres から Supabase Storage へ移す
// ============================================
// `banner_template.imageUrl` に base64 データURI で入っている348件を、
// 刷新v2の150件と同じ Storage 方式へ揃える。
//
// なぜやるか:
//   base64 が1枚平均1.79MB・合計608MBあり、このテーブルは行数を多く触るクエリで
//   Postgres が TOAST を展開して一気に重くなる。2026-08-24 にこれが引き金で
//   DBが新規接続を受け付けなくなり、ギャラリーもGoogleログインも同時に落ちた。
//   URLに置き換えると、一覧クエリが巨大データを読まなくなる。
//
// 実行:
//   npx tsx scripts/migrate-banner-templates-to-storage.ts          # 確認のみ
//   npx tsx scripts/migrate-banner-templates-to-storage.ts --apply  # 実際に移す
//   ... --limit 20   # 件数を絞って試す
//
// ⚠️ DBに負荷をかけない作りにしてある。1件ずつ templateId で引き、同時実行は2、
//    1件ごとに少し待つ。一覧を丸ごと取る形にすると障害を再発させるので変えないこと。
// 途中で止めても安全。https:// になった行は次回スキップする。
import path from 'path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { loadEnv } from './_env'

loadEnv()

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

const BUCKET = 'banner-templates'
const PREFIX = 'legacy-2026-08-24'
// 画像配信ルートの STORAGE_VARIANT_WIDTHS と必ず揃えること。
const VARIANT_WIDTHS = [300, 600, 1280]
const CONCURRENCY = 2
const PAUSE_MS = 150

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL } },
})

const sb = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です')
  return createClient(url, key, { auth: { persistSession: false } })
})()

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function migrateOne(templateId: string): Promise<'moved' | 'skipped' | 'failed'> {
  // ⚠️ ここだけが重い処理（1件1.79MB）。まとめて取らないこと。
  const row = await prisma.bannerTemplate.findUnique({
    where: { templateId },
    select: { imageUrl: true },
  })
  const src = row?.imageUrl
  if (!src) return 'skipped'
  if (!src.startsWith('data:image/')) return 'skipped' // 既に移行済み or 外部URL

  const m = src.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return 'skipped'
  const original = Buffer.from(m[2], 'base64')

  // 原寸も WebP に揃える（元は PNG が多く、そのままだと重い）
  const base = await sharp(original).webp({ quality: 88 }).toBuffer()
  const objects: { key: string; body: Buffer }[] = [{ key: `${PREFIX}/${templateId}.webp`, body: base }]
  for (const w of VARIANT_WIDTHS) {
    objects.push({
      key: `${PREFIX}/${templateId}-w${w}.webp`,
      body: await sharp(original).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    })
  }

  if (!APPLY) return 'moved'

  for (const o of objects) {
    const { error } = await sb.storage.from(BUCKET).upload(o.key, o.body, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) throw new Error(`${o.key}: ${error.message}`)
  }

  const pub = (key: string) => sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
  await prisma.bannerTemplate.update({
    where: { templateId },
    data: {
      imageUrl: pub(`${PREFIX}/${templateId}.webp`),
      previewUrl: pub(`${PREFIX}/${templateId}-w600.webp`),
    },
  })
  return 'moved'
}

async function main() {
  // 対象のIDだけを取る（imageUrl は選ばないので軽い）
  const targets: { templateId: string }[] = await prisma.$queryRawUnsafe(
    `SELECT "templateId" FROM banner_template
     WHERE "isActive" = true AND "imageUrl" LIKE 'data:%'
     ORDER BY "templateId"`
  )
  const queue = targets.slice(0, LIMIT === Infinity ? targets.length : LIMIT).map(t => t.templateId)

  console.log(`${APPLY ? '【移行】' : '【確認のみ・書き込みません】'} 対象 ${targets.length}件 / 今回 ${queue.length}件`)

  let moved = 0, skipped = 0
  const failures: string[] = []
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const id = queue.shift()
      if (!id) return
      try {
        const r = await migrateOne(id)
        if (r === 'moved') moved++
        else skipped++
      } catch (e: any) {
        failures.push(`${id}: ${e.message}`)
      }
      if ((moved + skipped) % 25 === 0) console.log(`  ${moved + skipped} 件処理（移行${moved} / 対象外${skipped}）`)
      await sleep(PAUSE_MS)
    }
  })
  await Promise.all(workers)

  console.log(`\n移行 ${moved}件 / 対象外 ${skipped}件 / 失敗 ${failures.length}件`)
  failures.slice(0, 20).forEach(f => console.log('  ' + f))
  if (failures.length) process.exitCode = 1

  if (APPLY) {
    const after: any[] = await prisma.$queryRawUnsafe(
      `SELECT count(*) FILTER (WHERE "imageUrl" LIKE 'data:%')::int AS base64,
              count(*) FILTER (WHERE "imageUrl" LIKE 'https://%')::int AS storage
       FROM banner_template WHERE "isActive" = true`
    )
    console.log(`残り base64=${after[0].base64} / Storage=${after[0].storage}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
