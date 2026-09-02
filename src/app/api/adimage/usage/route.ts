export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// 広告画像AI: 生成枚数と残り枚数
// ============================================
// サイドバーに「今月◯枚 / 残り◯枚」を出すためだけの読み取り専用API。
// ⚠️ 上限の数字はここに書かない。assertQuota と同じ access.ts の定数を参照する
//    （二重管理すると、表示は残っているのに生成が弾かれる状態になる）。
import { NextRequest, NextResponse } from 'next/server'
import {
  DAILY_CONCEPT_LIMIT,
  DAILY_IMAGE_LIMIT,
  MONTHLY_IMAGE_LIMIT,
  conceptsToday,
  getIdentity,
  imagesSince,
  jstStartOfMonthUtc,
  jstStartOfTodayUtc,
  ownerWhere,
} from '@/lib/adimage/access'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const id = await getIdentity(req)
    const where = ownerWhere(id)

    // 未ログイン（保存先が無い）なら数えるものが無い
    if (!where) {
      return NextResponse.json({
        plan: id.plan,
        signedIn: false,
        total: 0,
        today: { used: 0, limit: DAILY_IMAGE_LIMIT[id.plan] },
        month: { used: 0, limit: MONTHLY_IMAGE_LIMIT[id.plan] },
        concepts: { used: 0, limit: DAILY_CONCEPT_LIMIT[id.plan] },
      })
    }

    const [total, today, month, concepts] = await Promise.all([
      // これまでに作った全枚数
      prisma.adImageCreative.count({ where: { concept: { campaign: where } } }),
      imagesSince(id, jstStartOfTodayUtc()),
      imagesSince(id, jstStartOfMonthUtc()),
      conceptsToday(id),
    ])

    return NextResponse.json({
      plan: id.plan,
      signedIn: true,
      total,
      // limit が null = 上限なし（プロ）
      today: { used: today, limit: DAILY_IMAGE_LIMIT[id.plan] },
      month: { used: month, limit: MONTHLY_IMAGE_LIMIT[id.plan] },
      concepts: { used: concepts, limit: DAILY_CONCEPT_LIMIT[id.plan] },
    })
  } catch (e) {
    console.error('[adimage] usage failed', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: '使用状況を取得できませんでした' }, { status: 500 })
  }
}
