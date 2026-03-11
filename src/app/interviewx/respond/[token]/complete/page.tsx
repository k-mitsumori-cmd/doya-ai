'use client'

// ============================================
// 回答完了ページ（Thank You ページ）
// ============================================
// ヒヤリング完了後のリダイレクト先
// ブランドカラー対応・会社ブランディング表示

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ProjectInfo {
  title: string
  companyName?: string
  companyLogo?: string
  brandColor: string
}

export default function CompletePage() {
  const params = useParams()
  const token = params.token as string

  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`/api/interviewx/public/${token}/status`)
        const data = await res.json()
        if (data.success && data.project) {
          setProject(data.project)
        }
      } catch {
        // エラー時もページは表示する
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [token])

  const brandColor = project?.brandColor || '#3B82F6'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ヘッダーグラデーション */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC, ${brandColor}99)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full -translate-y-1/2 translate-x-1/3"
            style={{ backgroundColor: '#FFFFFF' }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 py-8">
          {project?.companyLogo && (
            <img
              src={project.companyLogo}
              alt={project?.companyName || ''}
              className="h-8 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          )}
          {project?.companyName && !project?.companyLogo && (
            <p className="text-white/80 text-sm font-medium">{project.companyName}</p>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-12 max-w-lg w-full text-center">
          {/* チェックマーク */}
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${brandColor}15` }}
          >
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke={brandColor}
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
            ご回答ありがとうございました
          </h1>

          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            お忙しい中ご回答いただき、誠にありがとうございます。
            <br />
            いただいた回答をもとに、AIが要約を自動生成いたします。
          </p>

          <div className="bg-slate-50 rounded-xl p-5 text-left mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3">今後の流れ</h3>
            <div className="space-y-3">
              {[
                { step: '1', label: '要約の自動生成', desc: 'AIがヒヤリング内容を要約します' },
                { step: '2', label: '内容の確認', desc: '担当者が要約を確認・調整します' },
                { step: '3', label: '完了', desc: 'ヒヤリング結果が共有されます' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: brandColor }}
                  >
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {project?.title && (
            <p className="text-xs text-slate-400">
              回答対象: {project.title}
            </p>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="py-6 text-center">
        <p className="text-xs text-slate-400">
          Powered by ドヤヒヤリングAI
        </p>
      </div>
    </div>
  )
}
