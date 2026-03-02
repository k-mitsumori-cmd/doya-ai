'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CodeExporter from '@/components/opening/CodeExporter'

export default function ExportPage() {
  const params = useParams()
  const router = useRouter()
  const animationId = params.animationId as string
  const [files, setFiles] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/opening/animations/${animationId}/export`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.files) setFiles(data.files)
      })
      .finally(() => setLoading(false))
  }, [animationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[#EF4343] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white/40">コードを生成しています...</p>
        </div>
      </div>
    )
  }

  if (!files) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-white/40 mb-4">エクスポートデータが見つかりません</p>
        <button onClick={() => router.back()} className="text-[#EF4343]">戻る</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-2xl font-black text-white mb-8">コードエクスポート</h1>
      <CodeExporter
        files={files}
        onBack={() => router.back()}
        isPro={false}
      />
    </div>
  )
}
