'use client'
// ============================================
// ログアウトしたら、最近作った物の記録（成果物の受け渡し (7)）を消す
// ============================================
// どのログアウトの道すじ（左下のボタン・各ツールの signOut()・/api/auth/signout・セッションの期限切れ）でも消えるよう、
// ボタンではなく「セッションが無くなったこと」を見て消す（統括の点検 2026-10-26 中2）。ルートの layout に1つだけ置く。
// ログインしている間は、ほかのユーザーの記録（同じ端末で前に使った人）も消す。
// ⚠️ 記録に残るのは種類・id・時刻だけ（表示名は残さない）。旗が off でも、消すだけなので害はない。
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { clearAllRecentArtifacts, clearOtherUsersArtifacts } from '@/lib/notice/artifacts'

export default function ClearArtifactsOnSignOut() {
  const { data, status } = useSession()
  const userKey = (data?.user as { id?: string } | undefined)?.id ?? data?.user?.email ?? ''
  useEffect(() => {
    if (status === 'unauthenticated') clearAllRecentArtifacts()
    else if (status === 'authenticated' && userKey) clearOtherUsersArtifacts(userKey)
  }, [status, userKey])
  return null
}
