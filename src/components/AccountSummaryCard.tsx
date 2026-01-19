'use client'

import Link from 'next/link'
import { LogIn, LogOut, Mail, User } from 'lucide-react'

type AccountSummaryCardProps = {
  serviceName: string
  planLabel: string
  isLoggedIn: boolean
  user: { name?: string | null; email?: string | null; image?: string | null } | null | undefined
  loginHref: string
  onLogout: () => void | Promise<void>
}

export function AccountSummaryCard({
  serviceName,
  planLabel,
  isLoggedIn,
  user,
  loginHref,
  onLogout,
}: AccountSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black text-slate-500">アカウント</p>
          <h2 className="text-lg font-black text-slate-900">{serviceName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">現在のプラン：</span>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">
            {planLabel}
          </span>
        </div>
      </div>

      {isLoggedIn ? (
        <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border border-blue-200 flex-shrink-0">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-slate-900 truncate">{user?.name || 'ユーザー'}</p>
              <p className="text-sm text-slate-500 font-bold flex items-center gap-1 truncate">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-500 font-bold">ログインしていません</p>
          <Link
            href={loginHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            ログイン
          </Link>
        </div>
      )}
    </section>
  )
}
