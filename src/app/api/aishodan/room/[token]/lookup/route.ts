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

type Ctx = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const usable = assertSessionUsable(s, { requireStarted: true })
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const question = String(body?.question || '').trim()
  if (!question) return NextResponse.json({ evidence: [], found: false })

  try {
    const chunks = await retrieve(s.room.scenario.product.id, question, 4)
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${s.id} FOR NO KEY UPDATE`
      const current = await loadGuestSession(req, p.token, s.id, tx)
      if (!current) return NextResponse.json({ error: '商談が見つかりません。' }, { status: 404 })
      const allowed = assertSessionUsable(current, { requireStarted: true })
      if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: allowed.status })
      if (current.room.scenario.product.id !== s.room.scenario.product.id) {
        return NextResponse.json({ error: '商材が変更されました。もう一度お試しください。' }, { status: 409 })
      }
      const cfg = toScenarioConfig(current.room.scenario)
      const profile = (current.room.scenario.product.profile as ProductProfile | null) ?? {}

      // 1. 確定済みプロフィールのFAQが最上位の根拠
      const faqHit = (profile.faq || []).find((f) => {
        const q = f.q.replace(/\s/g, '')
        const asked = question.replace(/\s/g, '')
        return q.includes(asked.slice(0, 8)) || asked.includes(q.slice(0, 8))
      })

      const evidence: { text: string; chunkId?: string }[] = []
      if (faqHit) evidence.push({ text: `【よくある質問】Q: ${faqHit.q}\nA: ${faqHit.a}` })
      for (const c of chunks) {
        evidence.push({ text: c.sourceTitle ? `【${c.sourceTitle}】\n${c.text}` : c.text, chunkId: c.id })
      }

      // 価格に触れない設定なら、価格を含む根拠は返さない。
      // ⚠️ 指示文だけで抑えると、根拠に金額が載っている限りモデルは読み上げてしまう。
      //    材料そのものを渡さないのが確実。
      let filtered = evidence
      if (cfg.guardrails.pricePolicy === 'withhold') {
        filtered = evidence.filter((e) => !/[¥￥]|円|万円|price|プラン料金/i.test(e.text))
      }

      filtered = filtered.slice(0, 4)

      const found = filtered.length > 0

      // 質問は必ず記録する。答えられなかったものはナレッジ拡充の優先順位になる
      await tx.aishodanQuestion.create({
        data: {
          sessionId: s.id,
          text: question.slice(0, 2000),
          citedChunkIds: filtered.flatMap(e => e.chunkId ? [e.chunkId] : []),
          unanswered: !found,
        },
      })

      return NextResponse.json({
        found,
        evidence: filtered.map((e) => e.text.slice(0, 1500)),
        // モデルが根拠なしのときに何をすべきかを、戻り値でも念押しする
        instruction: found
          ? '上の根拠だけに基づいて答えてください。根拠に書かれていないことを足さないでください。'
          : cfg.guardrails.noEvidenceBehavior === 'defer'
            ? '根拠が見つかりませんでした。答えを作らず、「確認して担当者から折り返しご連絡します」と伝えてください。'
            : '根拠が見つかりませんでした。一般論であることを明示し、断定せず簡潔に答えてください。',
      })
    }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
  } catch {
    return NextResponse.json({ error: '検索結果を保存できませんでした。もう一度お試しください。' }, { status: 503 })
  }
}
