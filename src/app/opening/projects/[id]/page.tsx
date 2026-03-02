'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react'
import AnimationGrid from '@/components/opening/AnimationGrid'
import AnimationPreview from '@/components/opening/AnimationPreview'
import SiteAnalysisProgress from '@/components/opening/SiteAnalysisProgress'

interface ProjectData {
  id: string
  inputUrl: string
  status: string
  siteAnalysis: any
  animations: Array<{
    id: string
    templateId: string
    config: any
    metadata?: any
  }>
}

const MAX_POLL_COUNT = 60 // 60 × 3秒 = 最大3分

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const pollCountRef = useRef(0)
  const cancelledRef = useRef(false)

  const fetchProject = async () => {
    if (cancelledRef.current) return
    try {
      const res = await fetch(`/api/opening/projects/${projectId}`)
      const data = await res.json()
      if (cancelledRef.current) return
      if (data.project) {
        setProject(data.project)
        // ANALYZINGの場合、タイムアウトまでポーリング
        if (data.project.status === 'ANALYZING') {
          pollCountRef.current++
          if (pollCountRef.current < MAX_POLL_COUNT) {
            setTimeout(fetchProject, 3000)
          } else {
            setPollTimedOut(true)
          }
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cancelledRef.current = false
    pollCountRef.current = 0
    fetchProject()
    return () => { cancelledRef.current = true }
  }, [projectId])

  // 再試行: 新しい解析をトリガー
  const handleRetry = async () => {
    if (!project) return
    setLoading(true)
    setPollTimedOut(false)
    pollCountRef.current = 0
    cancelledRef.current = false
    try {
      const res = await fetch('/api/opening/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: project.inputUrl }),
      })
      const data = await res.json()
      if (data.success && data.projectId) {
        router.replace(`/opening/projects/${data.projectId}`)
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-[#EF4343] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-white/40 mb-4">プロジェクトが見つかりません</p>
        <button onClick={() => router.push('/opening')} className="text-[#EF4343]">戻る</button>
      </div>
    )
  }

  // エラー状態 or ポーリングタイムアウト
  if (project.status === 'ERROR' || pollTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EF4343]/10 mb-6">
          <AlertTriangle className="h-8 w-8 text-[#EF4343]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {project.status === 'ERROR' ? 'サイトの解析中にエラーが発生しました' : 'サイトの解析に時間がかかっています'}
        </h2>
        <p className="text-sm text-white/40 mb-2">{project.inputUrl}</p>
        <p className="text-sm text-white/30 mb-8 max-w-md text-center">
          {project.status === 'ERROR'
            ? 'サイトへのアクセスに失敗したか、一時的なエラーが発生しました。再試行をお試しください。'
            : '通常30秒程度で完了しますが、サーバーが混み合っている可能性があります。再試行してください。'}
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/opening')}
            className="px-5 py-2.5 text-sm text-white/50 hover:text-white border border-white/10 rounded-xl transition-colors"
          >
            トップに戻る
          </button>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#EF4343] rounded-xl hover:bg-[#DC2626] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            再試行
          </button>
        </div>
      </div>
    )
  }

  if (project.status === 'ANALYZING') {
    return (
      <SiteAnalysisProgress
        url={project.inputUrl}
        colors={project.siteAnalysis?.colors?.palette}
      />
    )
  }

  const animations = project.animations.map(a => {
    const meta = (a.metadata || {}) as any
    return {
      id: a.id,
      templateId: a.templateId,
      name: meta.name || a.templateId,
      nameEn: meta.nameEn || a.templateId,
      description: meta.description || '',
      isPro: meta.isPro || false,
      config: a.config as any,
    }
  })

  const previewAnim = previewId ? animations.find(a => a.id === previewId) : null

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/opening/dashboard')}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          プロジェクト一覧
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">テンプレートを選択</h1>
            <p className="text-sm text-white/40">{project.inputUrl}</p>
          </div>

          {/* Color palette display */}
          {project.siteAnalysis?.colors?.palette && (
            <div className="hidden md:flex items-center gap-2">
              {(project.siteAnalysis.colors.palette as string[]).slice(0, 5).map((c: string, i: number) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full border border-white/10"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <AnimationGrid
        animations={animations}
        userPlan="FREE"
        onPreview={(id) => setPreviewId(id)}
        onSelect={(id) => router.push(`/opening/editor/${id}`)}
      />

      {/* Preview Modal */}
      {previewAnim && (
        <AnimationPreview
          isOpen={!!previewId}
          onClose={() => setPreviewId(null)}
          onSelect={() => router.push(`/opening/editor/${previewAnim.id}`)}
          templateId={previewAnim.templateId}
          templateName={previewAnim.name}
          config={previewAnim.config}
        />
      )}
    </div>
  )
}
