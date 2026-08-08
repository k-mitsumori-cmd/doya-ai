export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/lookup — lookup_knowledge の受け口
//
// ⚠️ 本サービスの信頼性の中核。
//    根拠が見つからないときは**空を返す**。それらしい説明を返してはいけない。
//    答えられなかった質問は unanswered として記録し、ホストのナレッジ拡充につなげる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertSessionUsable, loadGuestSession } from '@/lib/aishodan/session'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { retrieve } from '@/lib/aishodan/knowledge'
import type { ProductProfile } from '@/lib/aishodan/types'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const usable = assertSessionUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const question = String(body?.question || '').trim()
  if (!question) return NextResponse.json({ evidence: [], found: false })

  const cfg = toScenarioConfig(s.room.scenario)
  const profile = (s.room.scenario.product.profile as ProductProfile | null) ?? {}

  // 1. 確定済みプロフィールのFAQが最上位の根拠
  const faqHit = (profile.faq || []).find((f) => {
    const q = f.q.replace(/\s/g, '')
    const asked = question.replace(/\s/g, '')
    return q.includes(asked.slice(0, 8)) || asked.includes(q.slice(0, 8))
  })

  // 2. 取り込んだ資料から検索
  const chunks = await retrieve(s.room.scenario.product.id, question, 4)

  const evidence: string[] = []
  const citedChunkIds: string[] = []
  if (faqHit) evidence.push(`【よくある質問】Q: ${faqHit.q}\nA: ${faqHit.a}`)
  for (const c of chunks) {
    evidence.push(c.sourceTitle ? `【${c.sourceTitle}】\n${c.text}` : c.text)
    citedChunkIds.push(c.id)
  }

  // 価格に触れない設定なら、価格を含む根拠は返さない。
  // ⚠️ 指示文だけで抑えると、根拠に金額が載っている限りモデルは読み上げてしまう。
  //    材料そのものを渡さないのが確実。
  let filtered = evidence
  if (cfg.guardrails.pricePolicy === 'withhold') {
    filtered = evidence.filter((e) => !/[¥￥]|円|万円|price|プラン料金/i.test(e))
  }

  const found = filtered.length > 0

  // 質問は必ず記録する。答えられなかったものはナレッジ拡充の優先順位になる
  await prisma.aishodanQuestion.create({
    data: {
      sessionId: s.id,
      text: question.slice(0, 2000),
      citedChunkIds: found ? citedChunkIds : [],
      unanswered: !found,
    },
  }).catch(() => {})

  return NextResponse.json({
    found,
    evidence: filtered.slice(0, 4).map((e) => e.slice(0, 1500)),
    // モデルが根拠なしのときに何をすべきかを、戻り値でも念押しする
    instruction: found
      ? '上の根拠だけに基づいて答えてください。根拠に書かれていないことを足さないでください。'
      : cfg.guardrails.noEvidenceBehavior === 'defer'
        ? '根拠が見つかりませんでした。答えを作らず、「確認して担当者から折り返しご連絡します」と伝えてください。'
        : '根拠が見つかりませんでした。一般論であることを明示し、断定せず簡潔に答えてください。',
  })
}
