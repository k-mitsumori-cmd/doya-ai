'use client'

// ============================================
// フィードバックカードの設置（全ページ共通）
// ============================================
// ⚠️ 各サービスのページに個別に貼らない。20以上あるので必ず貼り忘れが出るし、
//    新サービスを足すたびに漏れる。URLからサービスを判定して1箇所で出す。

import { usePathname } from 'next/navigation'
import FeedbackPrompt from './FeedbackPrompt'
import { SERVICES } from '@/lib/services'

/**
 * 出してはいけない場所。
 * ⚠️ 第三者（応募者・見込み客）が開く画面には絶対に出さない。
 *    自社のアンケートを、面接や商談に来た相手に見せるのは不適切。
 */
const EXCLUDED_PREFIXES = [
  '/m/',              // 商談ルーム（見込み客）
  '/mensetsu/live/',  // 面接本番（応募者）
  '/admin',
  '/auth',
  '/api',
]

/** パスからサービスIDを判定する（'/quote/documents/x' → 'quote'） */
function serviceIdFromPath(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean)[0]
  if (!seg) return null
  // services.ts の href と突き合わせる。定義に無いパスでは出さない
  const hit = SERVICES.find((s) => s.href === `/${seg}`)
  return hit ? hit.id : null
}

export default function FeedbackMount() {
  const pathname = usePathname() || ''
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return null

  const serviceId = serviceIdFromPath(pathname)
  if (!serviceId) return null

  return <FeedbackPrompt serviceId={serviceId} />
}
