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
import { randomUUID } from 'crypto'

import { detectSelfHarmRisk, SAFETY_RESOURCES } from '@/lib/mitsuboshi/_shared/safety'
import { checkNagusameLimit } from '@/lib/mitsuboshi/nagusame/limits'
import { getPersonasForSegment } from '@/lib/mitsuboshi/nagusame/personas'
import { generateNagusameReplies } from '@/lib/mitsuboshi/nagusame/generation'
import type { NagusameSegment } from '@/lib/mitsuboshi/nagusame/types'

const GUEST_COOKIE = 'mitsuboshi_guest_id'

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

    // ゲストID を cookie から取得 or 発行
    let guestId = req.cookies.get(GUEST_COOKIE)?.value || null
    let setGuestCookie = false
    if (!userId && !guestId) {
      guestId = randomUUID()
      setGuestCookie = true
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
          const message = error instanceof Error ? error.message : '不明なエラー'
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

    if (setGuestCookie && guestId) {
      // ゲストID Cookie を付与（30日）
      // - HttpOnly: XSSでJSから読まれない
      // - SameSite=Lax: CSRFを軽減しつつ通常リンク遷移は許可
      // - Secure: 本番（HTTPS）でのみ。ローカル開発(http)では付けない
      const isProduction = process.env.NODE_ENV === 'production'
      const cookieParts = [
        `${GUEST_COOKIE}=${guestId}`,
        'Path=/',
        `Max-Age=${60 * 60 * 24 * 30}`,
        'SameSite=Lax',
        'HttpOnly',
      ]
      if (isProduction) cookieParts.push('Secure')
      res.headers.append('Set-Cookie', cookieParts.join('; '))
    }

    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : '予期せぬエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
