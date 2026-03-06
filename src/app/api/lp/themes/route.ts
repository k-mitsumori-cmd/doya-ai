export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LP_THEMES, FREE_THEME_IDS } from '@/lib/lp/themes'

// Free: 3テーマ（Corporate/Minimal/Warm）
// Light: 5テーマまで
// Pro/Enterprise: 全8テーマ
const LIGHT_THEME_IDS = ['corporate', 'minimal', 'warm', 'creative', 'bold']

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}
function isLightOrAbove(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['LIGHT', 'PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  let plan = 'FREE'

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    plan = String(user?.plan || 'FREE').toUpperCase()
  }

  // プランに応じてテーマにロック状態を付与
  const themes = LP_THEMES.map((theme) => {
    let locked = false
    if (isProPlan(plan)) {
      // Pro以上: 全テーマ利用可能
      locked = false
    } else if (isLightOrAbove(plan)) {
      // Light: 5テーマまで
      locked = !LIGHT_THEME_IDS.includes(theme.id)
    } else {
      // Free: 3テーマのみ
      locked = !FREE_THEME_IDS.includes(theme.id)
    }
    return { ...theme, locked }
  })

  return NextResponse.json({ themes })
}
