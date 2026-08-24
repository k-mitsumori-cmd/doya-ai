'use client'

// ============================================
// ログイン状態を GTM（dataLayer）へ渡す
// ============================================
// なぜ要るか:
//   HubSpot の「無料相談」ポップアップは GTM のカスタムHTMLタグで全ページに
//   配信している。そのため**ログイン済みの有料利用者が作業している画面にも
//   広告が出る**。GTM 側でトリガーの除外条件を書くには、アプリから
//   「いまログインしているか」を渡す必要がある。
//
// ⚠️ 個人を特定できる値（メール・氏名・ユーザーID）は入れないこと。
//    GTM 経由で外部ツールに流れる。渡すのは状態だけにする。
//
// GTM 側の設定（このコードだけでは完結しない）:
//   1. 変数 > ユーザー定義変数 > データレイヤーの変数 `user_state` を作る
//   2. HubSpot ポップアップのタグのトリガーに「除外」を追加し、
//      `user_state` が `logged_in` に等しいときは配信しない
//   3. 併せて `user_plan` を GA4 のユーザープロパティにすると、
//      無料/有料での行動差が見られる

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export function UserStateSignal() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // 未確定（loading）のうちは送らない。guest と誤って送ると、
    // ログイン済みの人にも一瞬ポップアップが出る余地が残る。
    if (status === 'loading') return
    if (typeof window === 'undefined') return

    const user = session?.user as { plan?: string } | undefined
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'user_state_ready',
      user_state: session?.user ? 'logged_in' : 'guest',
      user_plan: user?.plan || 'none',
    })
  }, [session, status])

  return null
}
