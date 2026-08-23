// ============================================
// バナーテンプレート画像 刷新v2 の投入
// ============================================
// reference/generated-assets/2026-08-23-banner-template-refresh-v2 の150枚を
// Supabase Storage に置き、banner_template に登録する。
//
// 依頼書: reference/banner-template-refresh-brief.md
//
// 既存348件（imageUrl に base64 データURI・DB内608MB）とは違い、新規分は
//   - 画像の実体は Storage（DBにはURLだけ）
//   - w=300/600/1280 のWebPを投入時に作って一緒に置く（実行時のsharp変換をなくす）
// という方針。既存分の移行は別タスク（このスクリプトは既存を触らない）。
//
// 実行:
//   npx tsx scripts/ingest-banner-templates-v2.ts          # 確認のみ（書き込まない）
//   npx tsx scripts/ingest-banner-templates-v2.ts --apply  # 実際に投入する
//
// 何度流しても同じ結果になる（Storageは upsert、DBは templateId で upsert）。
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { loadEnv } from './_env'

loadEnv()

const APPLY = process.argv.includes('--apply')
const ROOT = path.resolve(__dirname, '..')
const BATCH_DIR = path.join(ROOT, 'reference/generated-assets/2026-08-23-banner-template-refresh-v2')
const BUCKET = 'banner-templates'
const PREFIX = 'v2-2026-08-23'
// 画像配信ルート（src/app/api/banner/test/image/[templateId]/route.ts）と同じ幅にすること。
// 片方だけ変えると、存在しないサムネイルへリダイレクトして404になる。
const VARIANT_WIDTHS = [300, 600, 1280]
const CONCURRENCY = 6

type Req = {
  templateId: string
  genre: string
  genreSlug: string
  prompt: Record<string, any>
  output: { imagePath: string; width: number; height: number; format: string }
}

// マニフェストの prompt はオブジェクト。DBの prompt 列は「デザイン要素のみのプロンプト」で、
// 選択したテンプレのスタイルを引き継いで生成する時の basePrompt になる。
// そのため次の2つは**入れない**:
//   - text_verbatim（見本の文言。入れると利用者のバナーに見本のコピーが焼き込まれる）
//   - input_images / primary_request（手元の参照画像ファイル前提の指示で、本番には無い）
function toBasePrompt(prompt: Record<string, any>): string {
  const avoid = Array.isArray(prompt.avoid) ? prompt.avoid.join('; ') : ''
  return [
    prompt.original_concept && `Concept: ${prompt.original_concept}`,
    prompt.style_medium && `Style: ${prompt.style_medium}`,
    prompt.composition_framing && `Composition: ${prompt.composition_framing}`,
    prompt.typography && `Typography: ${prompt.typography}`,
    avoid && `Avoid: ${avoid}`,
  ].filter(Boolean).join('\n')
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL } },
})

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function ensureBucket() {
  const sb = supabase()
  const { data } = await sb.storage.getBucket(BUCKET)
  if (data) {
    if (!data.public) throw new Error(`バケット ${BUCKET} が非公開です。ギャラリーは公開URLで配信するため public である必要があります`)
    return
  }
  if (!APPLY) return
  // 画像はギャラリーの見本なので公開バケット。1枚あたり最大2MBで十分。
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/webp'],
  })
  if (error) throw new Error(`バケット作成に失敗: ${error.message}`)
  console.log(`バケット ${BUCKET} を作成しました（public）`)
}

/** 原寸＋サムネイル3枚をアップロードし、原寸の公開URLを返す */
async function uploadOne(r: Req): Promise<{ imageUrl: string; previewUrl: string; bytes: number }> {
  const sb = supabase()
  const src = path.join(BATCH_DIR, r.output.imagePath)
  const original = fs.readFileSync(src)

  const objects: { key: string; body: Buffer }[] = [
    { key: `${PREFIX}/${r.templateId}.webp`, body: original },
  ]
  for (const w of VARIANT_WIDTHS) {
    const body = await sharp(original)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    objects.push({ key: `${PREFIX}/${r.templateId}-w${w}.webp`, body })
  }

  let bytes = 0
  for (const o of objects) {
    bytes += o.body.length
    if (!APPLY) continue
    const { error } = await sb.storage.from(BUCKET).upload(o.key, o.body, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '31536000',
    })
    if (error) throw new Error(`${o.key} のアップロードに失敗: ${error.message}`)
  }

  const pub = (key: string) => sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
  return {
    imageUrl: pub(`${PREFIX}/${r.templateId}.webp`),
    previewUrl: pub(`${PREFIX}/${r.templateId}-w600.webp`),
    bytes,
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, 'generation-requests.json'), 'utf8'))
  const requests: Req[] = manifest.requests
  if (requests.length !== 150) throw new Error(`150件のはずが ${requests.length} 件です`)

  // 実体の存在と寸法を先に全件確認する（途中で落ちると中途半端に入るため）
  for (const r of requests) {
    const f = path.join(BATCH_DIR, r.output.imagePath)
    if (!fs.existsSync(f)) throw new Error(`画像がありません: ${r.output.imagePath}`)
    if (r.output.width !== 1200 || r.output.height !== 628) {
      throw new Error(`${r.templateId} の寸法が 1200x628 ではありません`)
    }
  }

  // 並び順: ジャンルを1枚ずつ回す（各ジャンルの1番手→2番手…）。
  // 一覧APIは take=30 の先読みなので、これで最初の30件が「15ジャンル×2枚」になり、
  // どのカテゴリを開いても先頭に新規が出る。ジャンル単位で固めると3カテゴリしか埋まらない。
  const genres = Array.from(new Set(requests.map(r => r.genreSlug)))
  const rankInGenre = new Map<string, number>()
  const sortOrderOf = (r: Req) => {
    const rank = rankInGenre.get(r.genreSlug) ?? 0
    rankInGenre.set(r.genreSlug, rank + 1)
    return rank * genres.length + genres.indexOf(r.genreSlug)
  }
  const plan = requests.map(r => ({ req: r, sortOrder: sortOrderOf(r) }))

  console.log(`${APPLY ? '【投入】' : '【確認のみ・書き込みません】'} ${requests.length}枚 / ${genres.length}ジャンル`)
  await ensureBucket()

  let done = 0
  let totalBytes = 0
  const failures: string[] = []

  // 6並列で流す（Storageの往復が支配的なので直列だと遅い）
  const queue = [...plan]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) return
      const { req: r, sortOrder } = item
      try {
        const { imageUrl, previewUrl, bytes } = await uploadOne(r)
        totalBytes += bytes
        if (APPLY) {
          const row = {
            industry: r.genre,
            category: r.genreSlug,
            prompt: toBasePrompt(r.prompt),
            size: '1200x628',
            imageUrl,
            previewUrl,
            // 新規分を最初に見せるのが今回の目的なので全件 featured。
            isFeatured: true,
            isActive: true,
            sortOrder,
          }
          await prisma.bannerTemplate.upsert({
            where: { templateId: r.templateId },
            create: { templateId: r.templateId, ...row },
            update: row,
          })
        }
        done++
        if (done % 25 === 0) console.log(`  ${done}/${plan.length}`)
      } catch (e: any) {
        failures.push(`${r.templateId}: ${e.message}`)
      }
    }
  })
  await Promise.all(workers)

  console.log(`\n完了: ${done}/${plan.length}`)
  console.log(`アップロード量: ${(totalBytes / 1048576).toFixed(1)}MB（原寸＋w300/w600/w1280）`)
  if (failures.length) {
    console.log(`\n失敗 ${failures.length}件:`)
    failures.forEach(f => console.log('  ' + f))
    process.exitCode = 1
  }

  if (APPLY) {
    const featured = await prisma.bannerTemplate.count({ where: { isFeatured: true, isActive: true } })
    const total = await prisma.bannerTemplate.count({ where: { isActive: true, imageUrl: { not: null } } })
    console.log(`\nDB: isFeatured=${featured}件 / 有効テンプレート合計=${total}件`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
