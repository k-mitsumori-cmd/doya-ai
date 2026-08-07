export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/sessions/[id]/pdf — 評価レポートPDF（F2-5）
// ?transcript=1 で逐語ログも綴じる（既定は載せない。応募者の発言そのものであるため）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { weightedAverage } from '@/lib/mensetsu/evaluate'
import { generateReportPdf } from '@/lib/mensetsu/pdf'
import { LEVEL_LABELS, type MensetsuLevel, type Verdict } from '@/lib/mensetsu/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const includeTranscript = new URL(req.url).searchParams.get('transcript') === '1'

  // id だけで他組織の面接に到達させない（二重条件）
  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    include: {
      organization: { select: { name: true } },
      template: { include: { criteria: { orderBy: { ord: 'asc' } } } },
      scores: { include: { criterion: true } },
      turns: { orderBy: { ord: 'asc' } },
    },
  })
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (!s.evaluatedAt) {
    return NextResponse.json({ error: 'まだ評価が実行されていません' }, { status: 400 })
  }

  const scoreByCriterionId = new Map(s.scores.map((x) => [x.criterionId, x]))
  const average = weightedAverage(
    s.scores.map((x) => ({
      criterionKey: x.criterion.key,
      score: x.score,
      insufficient: x.insufficient,
      rationale: x.rationale || '',
      quotes: x.quotes,
    })),
    s.template.criteria.map((x) => ({ key: x.key, weight: x.weight }))
  )

  try {
    const pdf = await generateReportPdf({
      companyName: s.organization.name,
      jobTitle: s.template.jobTitle,
      levelLabel: LEVEL_LABELS[(s.template.level as MensetsuLevel) || 'mid'] || '中途',
      candidateName: s.candidateName,
      interviewedAt: s.endedAt,
      durationMin: s.template.durationMin,
      verdict: (s.verdict as Verdict) || null,
      average,
      overallComment: s.overallComment,
      recruiterReport: s.recruiterReport,
      criteria: s.template.criteria.map((cr) => {
        const sc = scoreByCriterionId.get(cr.id)
        return {
          name: cr.name,
          description: cr.description,
          score: sc?.score ?? null,
          insufficient: sc?.insufficient ?? true,
          rationale: sc?.rationale ?? null,
          quotes: sc?.quotes ?? [],
        }
      }),
      turns: s.turns.map((t) => ({ speaker: t.speaker, text: t.text })),
      includeTranscript,
    })

    // ファイル名にASCII以外を入れるとヘッダで壊れるため filename* (RFC 5987) を使う
    const base = `mensetsu-report-${s.id.slice(0, 8)}.pdf`
    const label = `${s.candidateName || '応募者'}_面接評価レポート.pdf`
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${base}"; filename*=UTF-8''${encodeURIComponent(label)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('[mensetsu] pdf error', e?.message)
    return NextResponse.json({ error: 'PDFの生成に失敗しました' }, { status: 502 })
  }
}
