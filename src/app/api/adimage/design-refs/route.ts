export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/adimage/design-refs?brandId=xxx — デザインの参考候補を返す
//
// ⚠️ 候補は**ドヤバナーAIのテンプレート498枚を流用**する。
//    広告画像AI用に別途デザインを作るのではなく、既に用意され検証も済んでいる
//    資産を使う（同じ会社の中で二重に持たない）。
//
// ⚠️ 返すのは「見た目の参考」であって、コピーや配置ではない。
//    選ばれたテンプレートの prompt を、生成時のアートディレクションとして混ぜる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity, ownerWhere, requireUser } from '@/lib/adimage/access'

/**
 * ブランドの業種から、近いテンプレート業種を引くための対応表。
 * ⚠️ バナー側の industry は表記ゆれがある（「飲料」「食品」「飲料・食品」など）。
 *    完全一致だけで引くと0件になり、候補が出ない画面になる。
 */
const INDUSTRY_HINTS: Array<{ match: RegExp; industries: string[] }> = [
  { match: /IT|SaaS|ソフト|テック|システム|アプリ|AI/i, industries: ['IT・テクノロジー', 'ビジネス・SaaS', 'IT・SaaS'] },
  { match: /美容|コスメ|化粧|エステ|サロン/, industries: ['美容・コスメ', 'ナチュラル・オーガニック'] },
  { match: /ファッション|アパレル|服|衣料/, industries: ['ファッション・アパレル', '高級・ラグジュアリー'] },
  { match: /飲食|食品|飲料|レストラン|カフェ|グルメ/, industries: ['飲料', '食品', '飲料・食品'] },
  { match: /旅行|観光|ホテル|宿|旅館/, industries: ['旅行・観光'] },
  { match: /教育|学習|スクール|塾|セミナー|研修/, industries: ['教育・学習・セミナー', '教育・セミナー'] },
  { match: /金融|保険|銀行|証券|投資/, industries: ['金融・保険'] },
  { match: /医療|クリニック|病院|ヘルスケア|薬/, industries: ['医療・ヘルスケア', '健康・フィットネス'] },
  { match: /採用|人材|転職|求人|HR/, industries: ['転職・採用・人材', '採用・転職'] },
  { match: /不動産|住宅|建築|リフォーム/, industries: ['住宅・不動産', '不動産・住宅'] },
  { match: /スポーツ|フィットネス|ジム|トレーニング/, industries: ['スポーツ・フィットネス', '健康・フィットネス'] },
  { match: /EC|通販|セール|ショップ|物販/, industries: ['EC・セール'] },
  { match: /ペット|動物/, industries: ['ペット・動物', '暮らし・ペット'] },
  { match: /イベント|メディア|広告|出版/, industries: ['イベント・メディア'] },
  { match: /暮らし|ライフスタイル|生活/, industries: ['ライフスタイル・暮らし', '暮らし・ペット'] },
]

export async function GET(req: NextRequest) {
  const base = await getIdentity(req)
  const auth = requireUser(base)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const where = ownerWhere(base)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const brandId = new URL(req.url).searchParams.get('brandId') || ''

  // 業種が分かれば優先的に寄せる。分からなくても候補は返す（空の画面にしない）
  let hintIndustries: string[] = []
  if (brandId) {
    // ⚠️ id だけで引かない。必ず所有者条件と併用する
    const brand = await prisma.adImageBrand.findFirst({ where: { id: brandId, ...where } })
    if (brand) {
      // ⚠️ AdImageBrand は industry / description を直接持つ（profile ではない）
      const haystack = [brand.name, brand.industry, brand.description].filter(Boolean).join(' ')
      for (const h of INDUSTRY_HINTS) {
        if (h.match.test(haystack)) hintIndustries.push(...h.industries)
      }
      hintIndustries = Array.from(new Set(hintIndustries))
    }
  }

  const rows = await prisma.bannerTemplate.findMany({
    where: { isActive: true, imageUrl: { not: null } },
    select: { templateId: true, industry: true, category: true, imageUrl: true, previewUrl: true, isFeatured: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { templateId: 'asc' }],
    take: 500,
  })

  // 業種が合うものを前に、それ以外を後ろに。全部返して画面側で絞らせる
  const matched = rows.filter((r) => hintIndustries.includes(r.industry))
  const rest = rows.filter((r) => !hintIndustries.includes(r.industry))

  return NextResponse.json({
    matchedIndustries: hintIndustries,
    // 業種が合うものだけの件数。0なら画面で「業種を絞れなかった」と出す
    matchedCount: matched.length,
    refs: [...matched, ...rest].map((r) => ({
      id: r.templateId,
      industry: r.industry,
      category: r.category,
      imageUrl: r.previewUrl || r.imageUrl,
      matched: hintIndustries.includes(r.industry),
    })),
  })
}
