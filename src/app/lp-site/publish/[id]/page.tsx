'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LpGenerationResult } from '@/lib/lp-site/types'
import { Loader2 } from 'lucide-react'

export default function LpPublishedPage() {
  const params = useParams()
  const publishId = params.id as string
  const [lpData, setLpData] = useState<LpGenerationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState<'pc' | 'sp'>('pc')

  useEffect(() => {
    const loadPublished = async () => {
      try {
        const response = await fetch(`/api/lp-site/publish?id=${publishId}`)
        if (!response.ok) throw new Error('公開LPを読み込めませんでした')
        const data = await response.json()
        setLpData(data)
      } catch (error) {
        console.error('Published LP load error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (publishId) {
      loadPublished()
    }
  }, [publishId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!lpData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">公開されたLPが見つかりませんでした</p>
          <a href="/lp-site" className="text-teal-500 hover:text-teal-600 underline">
            戻る
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">{lpData.product_info.product_name}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDevice('pc')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedDevice === 'pc'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              PC版
            </button>
            <button
              onClick={() => setSelectedDevice('sp')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedDevice === 'sp'
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              スマホ版
            </button>
          </div>
        </div>
      </div>

      {/* LP表示 */}
      <div className={`${selectedDevice === 'pc' ? 'max-w-full' : 'max-w-sm mx-auto'}`}>
        <div className="space-y-0">
          {lpData.sections.map((section, index) => {
            const image = lpData.images.find((img) => img.section_id === section.section_id)
            const imageData = selectedDevice === 'pc' ? image?.image_pc : image?.image_sp

            return (
              <div key={section.section_id} className="relative">
                {imageData ? (
                  <div className="relative group">
                    <img
                      src={imageData}
                      alt={section.headline}
                      className="w-full block"
                    />
                    {/* CTAリンクがある場合はオーバーレイボタンを表示 */}
                    {section.cta_link && section.cta_text && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
                        <a
                          href={section.cta_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-bold text-lg shadow-lg hover:from-teal-600 hover:to-cyan-600 transition-all inline-block"
                        >
                          {section.cta_text}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full bg-slate-100 min-h-[400px] flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <p className="text-lg font-bold mb-2">{section.headline}</p>
                      {section.sub_headline && <p className="text-sm mb-4">{section.sub_headline}</p>}
                      {section.cta_link && section.cta_text && (
                        <a
                          href={section.cta_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-bold text-lg shadow-lg hover:from-teal-600 hover:to-cyan-600 transition-all inline-block"
                        >
                          {section.cta_text}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}



