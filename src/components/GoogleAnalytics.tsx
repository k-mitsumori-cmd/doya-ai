'use client'

import { Suspense, useEffect } from 'react'
import Script from 'next/script'
import { useSession } from 'next-auth/react'
import { usePathname, useSearchParams } from 'next/navigation'

// GA4測定ID（ドヤマーケと同一プロパティ・同一ストリーム）
// 同一プロパティにすることで「ドヤマーケ記事 → doya-ai登録 → 課金」の
// 流入経路が一気通貫で計測できる（.surisuta.jp共通Cookieでセッション継続）
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-QMN2L5878G'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

function gaEvent(name: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params)
  }
}

// ツール利用として計測する第1パスセグメント（services.tsのhrefに対応）
const TOOL_PATHS = new Set([
  'banner', 'seo', 'interview', 'copy', 'lp', 'persona', 'voice', 'movie',
  'hr', 'kintai', 'adsim', 'tenkai', 'adbanner', 'aio', 'shodan', 'sfa',
  'promane', 'doyalist', 'doyaslide', 'cunning', 'interviewx', 'kantan',
])

// sign_up / purchase / login / tool_open の発火（重複防止つき）
function GaEventsTrackerInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // 課金完了: Stripe成功リダイレクト（?success=true&session_id=...）を検知
  useEffect(() => {
    try {
      const success = searchParams.get('success')
      const sessionId = searchParams.get('session_id')
      if (success === 'true' && sessionId) {
        const guardKey = `ga_purchase_${sessionId}`
        if (!localStorage.getItem(guardKey)) {
          gaEvent('purchase', {
            transaction_id: sessionId,
            value: 9980,
            currency: 'JPY',
            item_name: searchParams.get('plan') || 'pro',
          })
          localStorage.setItem(guardKey, '1')
        }
      }
    } catch {
      // localStorage不可（プライベートモード等）でも他機能に影響させない
    }
  }, [searchParams])

  // 新規登録: 初回ログイン直後（firstLoginAtが30分以内）に一度だけ発火
  useEffect(() => {
    try {
      const firstLoginAt = (session?.user as any)?.firstLoginAt
      if (!firstLoginAt) return
      if (localStorage.getItem('ga_signup_sent')) return
      const elapsedMs = Date.now() - new Date(firstLoginAt).getTime()
      if (elapsedMs >= 0 && elapsedMs < 30 * 60 * 1000) {
        gaEvent('sign_up', { method: 'google' })
        localStorage.setItem('ga_signup_sent', '1')
      }
    } catch {
      // noop
    }
  }, [session])

  // ログイン: 認証済みセッションをブラウザセッションごとに1回だけ記録
  // （どの流入経路のユーザーがツールを使いに来ているかの計測用）
  useEffect(() => {
    try {
      if (!(session?.user as any)?.id && !session?.user?.email) return
      if (sessionStorage.getItem('ga_login_sent')) return
      gaEvent('login', { method: 'google' })
      sessionStorage.setItem('ga_login_sent', '1')
    } catch {
      // noop
    }
  }, [session])

  // ツール利用: ログイン済みユーザーがツール配下ページを開いたら、
  // ツールごとにセッション1回だけ tool_open を記録
  useEffect(() => {
    try {
      if (!session?.user) return
      const seg = (pathname || '').split('/')[1] || ''
      if (!TOOL_PATHS.has(seg)) return
      const guardKey = `ga_tool_open_${seg}`
      if (sessionStorage.getItem(guardKey)) return
      gaEvent('tool_open', { tool: seg })
      sessionStorage.setItem(guardKey, '1')
    } catch {
      // noop
    }
  }, [session, pathname])

  return null
}

export function GoogleAnalytics() {
  if (!GA_ID) return null
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga-gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `,
        }}
      />
      <Suspense fallback={null}>
        <GaEventsTrackerInner />
      </Suspense>
    </>
  )
}
