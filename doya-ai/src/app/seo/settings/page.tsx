'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BellRing } from 'lucide-react'
import { readSeoClientSettings, patchSeoClientSettings, type SeoClientSettings } from '@seo/lib/clientSettings'

export default function SeoSettingsPage() {
  const [settings, setSettings] = useState<SeoClientSettings>(() => readSeoClientSettings())

  useEffect(() => {
    setSettings(readSeoClientSettings())
  }, [])

  return (
    <main className="max-w-3xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/seo"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs sm:text-sm mb-2 font-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">設定</h1>
          <p className="text-sm text-gray-500 mt-1">ドヤSEOの体験をカスタマイズできます。</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-xl shadow-blue-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <BellRing className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-gray-900">通知・ポップアップ</h2>
            <p className="text-xs font-bold text-gray-500 mt-1">記事が完成した瞬間の「完成！」演出を制御します。</p>
          </div>
        </div>

        <label className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/40 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.completionPopupEnabled}
            onChange={(e) => {
              const v = e.target.checked
              const next = patchSeoClientSettings({ completionPopupEnabled: v })
              setSettings(next)
            }}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">記事が完成したら「完成！」ポップアップを表示する</p>
            <p className="text-xs font-bold text-gray-500 mt-1">
              ONの場合、生成中に記事ページ/ジョブページを開いているときに、完成の瞬間だけ表示します。
            </p>
          </div>
        </label>
      </div>
    </main>
  )
}


