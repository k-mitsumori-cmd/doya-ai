'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, ArrowLeft } from 'lucide-react'
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

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/opening/projects/${projectId}`)
      const data = await res.json()
      if (data.project) {
        setProject(data.project)
        // If still analyzing, poll
        if (data.project.status === 'ANALYZING') {
          setTimeout(fetchProject, 3000)
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [projectId])

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
          templateName={previewAnim.name}
          colors={previewAnim.config.colors}
          texts={previewAnim.config.texts}
        />
      )}
    </div>
  )
}
