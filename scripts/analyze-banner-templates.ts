// ============================================
// バナーテンプレートのサムネイルを見て「作風」と「構図」を読み取る
// ============================================
// ⚠️ **なぜ画像を見る必要があるのか（絶対に文章から取らないこと）**
//    テンプレートの prompt はサムネイルを説明していない。
//    構造化テンプレ150枚の Style は10種類の定型文の使い回しで、
//    「写真を使っているか」すら実物と合わない。
//    例: 女性2人の写真が主役のテンプレに `typography as image`（文字が主役）
//        `porcelain stock-model face を避けよ`（人物写真を避けよ）が入っていた。
//    これを渡していたため、広告画像AIが全く違う絵を出していた（2026-09-02）。
//
// ⚠️ 従量課金APIを叩く（Geminiの画像入力）。実行前に見込み額の承認を得ること。
//    2026-09-02 実行分: 498枚 × 1回、$1未満の見込みで承認済み。
//
//   npx tsx scripts/analyze-banner-templates.ts          # 未解析のものだけ
//   npx tsx scripts/analyze-banner-templates.ts --all    # 全件やり直し
//   npx tsx scripts/analyze-banner-templates.ts --limit 10
import { loadEnv } from './_env'
loadEnv()

import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const prisma = new PrismaClient()

const COMPOSITIONS = [
  'photo-overlay', // 写真を全面に敷き、その上に文字を重ねている
  'panel-side', // 片側が単色パネルで文字、もう片側が写真
  'editorial-vertical', // 雑誌の誌面のように余白が大きく、写真と文字を重ねない
  'type-hero', // 文字が主役で、背景は控えめ
  'hero-center', // 中央に文字を集めた素直な構成
] as const

const argv = process.argv.slice(2)
const ALL = argv.includes('--all')
const LIMIT = (() => {
  const i = argv.indexOf('--limit')
  return i > -1 ? Math.max(1, Number(argv[i + 1]) || 0) : 0
})()
/** 同時実行数。⚠️ 上げすぎるとGemini側で429が出る */
const CONCURRENCY = 4

const API_KEY =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  ''
const MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-flash-latest'

const INSTRUCTION = [
  'これは広告バナーの完成画像です。この見た目を別の商材で再現するための情報を読み取ってください。',
  '',
  '【style】配色・色調・光・質感・余白の取り方・文字の書体の傾向・全体の雰囲気を、',
  '  60〜120字程度の日本語1文で。',
  '  ⚠️ 描かれている題材（何の商品か、どんな人物か、具体的な文言）は書かない。',
  '     別の商材に当てはめて使うため、題材が混ざると再現の邪魔になる。',
  '',
  '【usesPhoto】実写の写真を使っているか（true / false）。',
  '  ⚠️ ここが最重要。イラスト・図形・文字だけのものは false。',
  '     写真の有無を外すと、まったく違う絵になる。',
  '',
  '【composition】次から最も近いものを1つ:',
  '  photo-overlay      … 写真を全面に敷き、その上に文字を重ねている',
  '  panel-side         … 片側が単色パネルで文字、もう片側が写真',
  '  editorial-vertical … 雑誌の誌面のように余白が大きく、写真と文字を重ねない',
  '  type-hero          … 文字が主役で、背景は控えめ',
  '  hero-center        … 中央に文字を集めた素直な構成',
  '',
  '出力はJSONのみ: {"style":"...","usesPhoto":true,"composition":"photo-overlay"}',
].join('\n')

async function analyzeOne(imageUrl: string): Promise<{
  style: string
  usesPhoto: boolean
  composition: string
} | null> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`画像を取得できません: ${res.status}`)
  // ⚠️ 縮小して渡す。作風と構図の判定に原寸は要らず、転送量だけ増える
  const png = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: INSTRUCTION },
              { inline_data: { mime_type: 'image/png', data: png.toString('base64') } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    }
  )
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const j = await r.json()
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('応答が空です')
  const parsed = JSON.parse(text)
  const composition = COMPOSITIONS.includes(parsed?.composition)
    ? String(parsed.composition)
    : 'hero-center'
  return {
    style: String(parsed?.style || '').slice(0, 400),
    usesPhoto: parsed?.usesPhoto === true,
    composition,
  }
}

async function main() {
  if (!API_KEY) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')

  const rows = await prisma.bannerTemplate.findMany({
    where: {
      isActive: true,
      imageUrl: { not: null },
      ...(ALL ? {} : { derivedAt: null }),
    },
    select: { templateId: true, imageUrl: true, previewUrl: true },
    orderBy: { templateId: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  })
  console.log(`対象: ${rows.length}枚 / モデル: ${MODEL} / 同時${CONCURRENCY}`)

  let done = 0
  const failures: string[] = []
  const queue = [...rows]

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const row = queue.shift()
      if (!row) return
      const url = row.previewUrl || row.imageUrl
      if (!url) continue
      try {
        const a = await analyzeOne(url)
        if (!a) continue
        await prisma.bannerTemplate.update({
          where: { templateId: row.templateId },
          data: {
            derivedStyle: a.style,
            derivedComposition: a.composition,
            derivedUsesPhoto: a.usesPhoto,
            derivedAt: new Date(),
          },
        })
        done++
        if (done % 25 === 0) console.log(`  ${done}/${rows.length} 完了`)
      } catch (e) {
        failures.push(`${row.templateId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  })
  await Promise.all(workers)

  console.log(`\n完了 ${done}/${rows.length}枚`)
  if (failures.length) {
    console.log(`失敗 ${failures.length}件:`)
    failures.slice(0, 10).forEach((f) => console.log('  ' + f))
  }

  // 分布を出す。写真ありが極端に少ない/多いなら判定を疑う
  const dist = await prisma.$queryRawUnsafe<Array<{ derivedComposition: string; n: bigint }>>(
    `SELECT "derivedComposition", COUNT(*) AS n FROM "banner_template" WHERE "derivedAt" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`
  )
  console.log('\n構図の分布:')
  dist.forEach((d) => console.log(`  ${String(d.n).padStart(4)}枚  ${d.derivedComposition}`))
  const photo = await prisma.bannerTemplate.count({ where: { derivedUsesPhoto: true } })
  const total = await prisma.bannerTemplate.count({ where: { derivedAt: { not: null } } })
  console.log(`\n写真を使っている: ${photo}/${total}枚`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
