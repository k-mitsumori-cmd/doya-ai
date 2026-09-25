import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { canUseSeoImages, isTrialActive, normalizeSeoPlan } from '@/lib/seoAccess'

/** The server-side equivalent of /api/seo/entitlements for every image writer. */
export async function requireSeoImageAccess(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions)
  const user: any = session?.user || null
  const userId = String(user?.id || '').trim()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ code: 'LOGIN_REQUIRED', error: '画像を生成するにはログインしてください。' }, { status: 401 }) }
  }
  const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || 'FREE')
  const trialActive = isTrialActive(user?.firstLoginAt || null).active
  if (!canUseSeoImages({ isLoggedIn: true, plan, trialActive })) {
    return { ok: false, response: NextResponse.json({ code: 'SEO_IMAGE_PLAN_REQUIRED', error: '画像生成はLIGHT以上のプランで利用できます。', upgradeUrl: '/seo/dashboard/plan' }, { status: 403 }) }
  }
  return { ok: true, userId }
}
