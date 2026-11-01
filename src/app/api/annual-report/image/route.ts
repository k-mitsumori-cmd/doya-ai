// ============================================
// 年間レポートの共有画像（GET /api/annual-report/image）
// ============================================
// ?year=2026&size=wide|tall&show=company,customers,amounts,members&download=1
// - ドヤパワーの旗（src/lib/doya-power/flag.ts）が出さないと決めた人には、いちばん先に 404（見本も含む。セッションも DB も読まない）
// - 未ログインは 401、新しい見た目（src/lib/ui-next.ts）でない人は 404。どちらも DB を読まない
// - userId はいつもセッションから。会社（組織）の id はリクエストから受け取らない（本人の会社の分だけを読む）
// - show は既定で会社名だけ。顧客名・金額・社員名は、選んで、かつ会社の管理者（owner・admin）のときだけ入れる。
//   許していない項目は黙って外し、実際に入れた項目は X-Annual-Report-Revealed で返す
// - sample=1 は見本のデータ（DB を読まない）。ログインなしで使えるのは開発のときだけ
// ⚠️ 有料の生成 API は使わない（satori + resvg-js）。DB は読むだけ。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { currentUserId, getAccountCompanyName } from '@/lib/shell/company.server'
import {
  REVEAL_KEYS,
  allowedReveal,
  buildAnnualReport,
  parseRevealRequest,
  parseSize,
  parseYear,
  resolveReveal,
} from '@/lib/annual-report/report'
import { loadAnnualRawData, resolveAnnualAccess } from '@/lib/annual-report/load.server'
import { sampleAnnualRawData } from '@/lib/annual-report/sample'
import { renderAnnualImage } from '@/lib/annual-report/render.server'

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  if (!(await isDoyaPowerEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  const sp = new URL(req.url).searchParams
  const sample = sp.get('sample') === '1'
  // ⚠️ 開発のときだけ、ログインなしで見本を出す（画面の確認のため）。本番ではいつもログインと新しい見た目を確かめる
  const devSample = sample && process.env.NODE_ENV === 'development'

  let userId: string | null = null
  if (!devSample) {
    userId = await currentUserId()
    if (!userId) return NextResponse.json({ error: 'ログインしてください' }, { status: 401, headers: noStore })
  }

  const year = parseYear(sp.get('year'), new Date())
  const size = parseSize(sp.get('size'))
  const requested = parseRevealRequest(sp.get('show'))

  try {
    let report
    if (sample) {
      report = buildAnnualReport(sampleAnnualRawData(year), { year, reveal: resolveReveal(requested, REVEAL_KEYS) })
    } else {
      const access = await resolveAnnualAccess(prisma, userId!)
      const reveal = resolveReveal(requested, allowedReveal(access))
      const companyName = reveal.includes('company') ? (await getAccountCompanyName().catch(() => null))?.name ?? null : null
      const raw = await loadAnnualRawData(prisma, { userId: userId!, year, access, reveal, companyName })
      report = buildAnnualReport(raw, { year, reveal })
    }
    // ドヤくんを切る設定（mascot=0）のときは、枠の絵を使わない無地で作る
    const png = await renderAnnualImage(report, size, undefined, { plain: sp.get('mascot') === '0' })
    const filename = `doya-ai-annual-${year}-${size}.png`
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'image/png',
        'Content-Disposition': `${sp.get('download') === '1' ? 'attachment' : 'inline'}; filename="${filename}"`,
        'X-Annual-Report-Revealed': report.revealed.join(','),
      },
    })
  } catch {
    return NextResponse.json({ error: '画像を作れませんでした。時間をおいてもう一度お試しください' }, { status: 500, headers: noStore })
  }
}
