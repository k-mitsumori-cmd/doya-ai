'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, ChevronDown, ExternalLink } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { SERVICES } from '@/lib/services'

interface ServiceNavProps {
  currentService?: 'kantan' | 'banner' | null
}

export default function ServiceNav({ currentService }: ServiceNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // 現在のサービスを取得
  const current = currentService 
    ? SERVICES.find(s => s.id === currentService)
    : null

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {current ? current.name : 'サービス切替'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in">
          {/* ポータルへのリンク */}
          <Link href="/" onClick={() => setIsOpen(false)}>
            <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">ドヤAIポータル</p>
                  <p className="text-xs text-gray-500">サービス一覧を見る</p>
                </div>
              </div>
            </div>
          </Link>

          {/* サービス一覧 */}
          <div className="p-2">
            {SERVICES.map((service) => {
              const isActive = currentService === service.id
              return (
                <Link 
                  key={service.id} 
                  href={service.href}
                  onClick={() => setIsOpen(false)}
                >
                  <div className={`
                    flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
                  `}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                      <span className="text-xl">{service.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm">{service.name}</p>
                        {isActive && (
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                            現在
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">{service.description}</p>
                    </div>
                    {!isActive && <ExternalLink className="w-4 h-4 text-gray-400" />}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* 管理画面へのリンク */}
          <div className="p-2 border-t border-gray-100">
            <Link href="/admin" onClick={() => setIsOpen(false)}>
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                  <span className="text-lg">⚙️</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">管理画面</p>
                  <p className="text-xs text-gray-500">統合ダッシュボード</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// サービス間リンクバナー（サイドバー下部などに配置）
export function OtherServicesCard({ currentService }: { currentService: 'kantan' | 'banner' }) {
  const otherServices = SERVICES.filter(s => s.id !== currentService)

  return (
    <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        他のサービス
      </p>
      <div className="space-y-2">
        {otherServices.map((service) => (
          <Link key={service.id} href={service.href}>
            <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                <span className="text-lg">{service.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{service.name}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
      <Link href="/">
        <div className="mt-3 text-center py-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
          ← ポータルに戻る
        </div>
      </Link>
    </div>
  )
}

