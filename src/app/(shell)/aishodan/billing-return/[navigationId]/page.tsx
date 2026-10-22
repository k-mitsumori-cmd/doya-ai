'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The authenticated layout renders the neutral return selector before any workspace. */
export default function AishodanBillingReturnPage() {
  const path = usePathname() || '/aishodan'
  return <div className="mx-auto max-w-xl p-8 text-sm text-slate-700">
    <p>続けるにはログインして、作業する組織を確認してください。</p>
    <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(path)}`} className="mt-3 inline-block text-blue-700 underline">ログインする</Link>
  </div>
}
