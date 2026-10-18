// ============================================
// POST /api/mitsuboshi/nagusame/generate
// ============================================
// 三ツ星アプリ Vol.01 ナグサメの慰めコメント生成API
// - ユーザーの投稿を Claude API 多人格 fan-out
// - 返信が届き次第 SSE で逐次 push
// - 危機ワード検知時はセーフティエスカレーション
// - フリーミアム制限は limits.ts で判定

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { detectSelfHarmRisk, SAFETY_RESOURCES } from '@/lib/mitsuboshi/_shared/safety'
import { checkNagusameLimit, claimNagusameGuestIp } from '@/lib/mitsuboshi/nagusame/limits'
import { GUEST_COOKIE, guestCookieHeader, issueGuestId, readGuestId } from '@/lib/mitsuboshi/nagusame/guest'
import { getPersonasForSegment } from '@/lib/mitsuboshi/nagusame/personas'
import { generateNagusameReplies } from '@/lib/mitsuboshi/nagusame/generation'
import type { NagusameSegment } from '@/lib/mitsuboshi/nagusame/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null

    const body = await req.json().catch(() => ({}))
    const rawContent = typeof body?.content === 'string' ? body.content.trim() : ''
    const rawSegment = typeof body?.segment === 'string' ? body.segment : 'default'
    const segment: NagusameSegment =
      rawSegment === 'business' || rawSegment === 'student' ? rawSegment : 'default'

    if (!rawContent) {
      return NextResponse.json({ error: '本文を入力してください' }, { status: 400 })
    }
    if (rawContent.length > 1000) {
      return NextResponse.json({ error: '1000文字以内で入力してください' }, { status: 400 })
    }

    // ゲストID を cookie から取得 or 発行（署名の合わない値は使わない）
    let guestId = userId ? null : readGuestId(req.cookies.get(GUEST_COOKIE)?.value)
    let guestCookieValue: string | null = null
    if (!userId && !guestId) {
      const issued = issueGuestId()
      guestId = issued.guestId
      guestCookieValue = issued.cookieValue
    }

    // ゲストは Cookie を作り直せるため、接続元 IP ごとの上限も数える（数えられないときは止める）
    if (!userId) {
      const ipQuota = await claimNagusameGuestIp(req.headers, 'generate')
      if (ipQuota !== 'allowed') {
        return NextResponse.json(
          {
            error: ipQuota === 'limited'
              ? '本日の無料枠を使い切りました。ログインするか、明日もう一度お試しください。'
              : '混み合っています。時間をおいて再度お試しください。',
            limitReached: ipQuota === 'limited',
          },
          { status: ipQuota === 'limited' ? 429 : 503 }
        )
      }
    }

    // 利用制限判定
    const limit = await checkNagusameLimit({ userId, guestId })
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: limit.reason || '本日の無料枠を使い切りました',
          limitReached: true,
          usedToday: limit.usedToday,
          dailyLimit: limit.dailyLimit,
        },
        { status: 429 }
      )
    }

    // 投稿レコードを先に作成（safetyFlagged は後で更新）
    const isSafetyFlagged = detectSelfHarmRisk(rawContent)
    const post = await prisma.mitsuboshiNagusamePost.create({
      data: {
        userId: userId || undefined,
        guestId: !userId ? guestId || undefined : undefined,
        segment,
        content: rawContent,
        safetyFlagged: isSafetyFlagged,
        starsLit: 0,
      },
    })

    // 応答対象ペルソナ
    const personas = getPersonasForSegment(segment, limit.plan)
    const expectedReplies = personas.length

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false
        let starsCount = 0

        const safeEnqueue = (payload: unknown) => {
          if (streamClosed) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {
            streamClosed = true
          }
        }

        const safeClose = () => {
          if (streamClosed) return
          streamClosed = true
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }

        try {
          safeEnqueue({ type: 'start', postId: post.id, expectedReplies })

          // セーフティエスカレーション（投稿は保存するが返信は生成しない）
          if (isSafetyFlagged) {
            safeEnqueue({ type: 'safety_escalation', resources: SAFETY_RESOURCES })
            safeEnqueue({ type: 'done', postId: post.id, totalReplies: 0 })
            safeClose()
            return
          }

          // Claude fan-out
          await generateNagusameReplies({
            userMessage: rawContent,
            personas,
            onReply: (reply) => {
              starsCount += 1
              const persona = personas.find((p) => p.id === reply.personaId)
              safeEnqueue({
                type: 'reply',
                personaId: reply.personaId,
                personaName: reply.personaName,
                avatar: reply.avatar,
                imageUrl: persona?.imageUrl,
                content: reply.content,
                index: reply.orderIndex,
              })
              safeEnqueue({ type: 'star_lit', count: starsCount, total: expectedReplies })
              // DB保存は非同期 fire-and-forget（SSEレイテンシを犠牲にしない）
              prisma.mitsuboshiNagusameReply
                .create({
                  data: {
                    postId: post.id,
                    personaId: reply.personaId,
                    personaName: reply.personaName,
                    content: reply.content,
                  },
                })
                .catch(() => {
                  /* log skipped */
                })
            },
          })

          // 最終的な星数を投稿レコードに反映
          await prisma.mitsuboshiNagusamePost
            .update({
              where: { id: post.id },
              data: { starsLit: starsCount },
            })
            .catch(() => undefined)

          safeEnqueue({ type: 'done', postId: post.id, totalReplies: starsCount })
        } catch (error) {
          const message = '文章の生成に失敗しました。時間をおいて再度お試しください。'
          safeEnqueue({ type: 'error', message })
        } finally {
          safeClose()
        }
      },
    })

    const res = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })

    if (guestCookieValue) {
      // 署名付きのゲストID Cookie を付与（30日・HttpOnly・SameSite=Lax・本番のみ Secure）
      res.headers.append('Set-Cookie', guestCookieHeader(guestCookieValue))
    }

    return res
  } catch (err) {
    const message = '文章の生成に失敗しました。時間をおいて再度お試しください。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
