'use client'

// ドヤスライド プロジェクト一覧。
// 2026-06-13: ホーム(/doyaslide)を新規作成ウィザードに変更したため、一覧はこのパスへ移設。
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EmptyState } from '@/components/EmptyState'
import { doyaslideImageSrc } from '@/lib/doyaslide/file-urls'
import { ImageIcon, Trash2 } from 'lucide-react'
import { useUiNext } from '@/components/shell/ui-next-context'
import { Button, EmptyState as DsEmptyState, ToolHero, toolHeroArt } from '@/components/ds'
import { FirstSteps } from '@/components/ds/feedback'
import { confirmDialog } from '@/components/ds/dialog'

// プラン名は英語の内部の値で届くので、画面では日本語にする
const PLAN_LABEL: Record<string, string> = { GUEST: 'ゲスト', FREE: '無料', LIGHT: 'ライト', PRO: 'プロ', ENTERPRISE: '法人', BUSINESS: '法人' }
const planLabel = (plan: unknown) => (typeof plan === 'string' ? PLAN_LABEL[plan.toUpperCase()] || plan : '')

interface Project {
  id: string
  title: string
  docType: string
  status: string
  aspectRatio: string
  updatedAt: string
  coverUrl: string | null
  generatedSlides: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  structuring: '構成中',
  structured: '構成済み',
  generating: '生成中',
  completed: '完成',
  error: 'エラー',
}

export default function DoyaSlideProjectsPage() {
  // 新しい見た目（UI 品質の直し。チェックリスト §5.1）。偽のときは今までの見た目のまま
  const uiNext = useUiNext()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectsError, setProjectsError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [usage, setUsage] = useState<any>(null)
  const [usageError, setUsageError] = useState(false)
  const loadRequest = useRef(0)
  const deleteBusyRef = useRef(false)
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(() => {
    const request = ++loadRequest.current
    setLoading(true)
    setProjectsError(false)
    setLoadingMore(false)
    fetch('/api/doyaslide/projects?limit=30', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('プロジェクトを取得できませんでした')
        const data = await response.json()
        if (!Array.isArray(data.projects) || data.projects.length > 30 ||
            !Number.isSafeInteger(data.total) || data.total < data.projects.length ||
            (data.projects.length === 0 && data.total !== 0) ||
            data.projects.some((project: Project) => !project || typeof project.id !== 'string' || !project.id ||
              typeof project.title !== 'string' || !Number.isSafeInteger(project.generatedSlides) || project.generatedSlides < 0) ||
            (data.nextCursor !== null && (typeof data.nextCursor !== 'string' ||
              data.projects.length !== 30 || data.nextCursor !== data.projects[29]?.id))) {
          throw new Error('プロジェクトの応答が不正です')
        }
        if (request === loadRequest.current) {
          setProjects(data.projects)
          setTotal(data.total)
          setNextCursor(data.nextCursor)
        }
      })
      .catch(() => { if (request === loadRequest.current) setProjectsError(true) })
      .finally(() => { if (request === loadRequest.current) setLoading(false) })
    setUsage(null)
    setUsageError(false)
    fetch('/api/doyaslide/usage', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('利用状況を取得できませんでした')
        const data = await response.json()
        if (!data || !data.limits || !data.usage) throw new Error('利用状況の応答が不正です')
        if (request === loadRequest.current) setUsage(data)
      })
      .catch(() => { if (request === loadRequest.current) setUsageError(true) })
  }, [])
  useEffect(() => {
    const requestCounter = loadRequest
    load()
    return () => { requestCounter.current++ }
  }, [load])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    const request = loadRequest.current
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/doyaslide/projects?limit=30&cursor=${encodeURIComponent(nextCursor)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('続きを取得できませんでした')
      const data = await response.json()
      if (!Array.isArray(data.projects) || data.projects.length > 30 || data.total !== total ||
          data.projects.some((project: Project) => !project || typeof project.id !== 'string' || !project.id ||
            typeof project.title !== 'string' || !Number.isSafeInteger(project.generatedSlides) || project.generatedSlides < 0) ||
          (data.nextCursor !== null && (typeof data.nextCursor !== 'string' ||
            data.projects.length !== 30 || data.nextCursor !== data.projects[29]?.id)) ||
          data.projects.some((project: Project) => projects.some((existing) => existing.id === project.id)) ||
          (data.nextCursor === null && projects.length + data.projects.length !== total)) {
        throw new Error('履歴が更新されました。再読み込みしてください')
      }
      if (request !== loadRequest.current) return
      setProjects([...projects, ...data.projects])
      setNextCursor(data.nextCursor)
    } catch {
      if (request === loadRequest.current) toast.error('続きを読み込めませんでした。少し待って、もう一度お試しください。')
    } finally {
      if (request === loadRequest.current) setLoadingMore(false)
    }
  }

  const remove = async (id: string) => {
    if (deleteBusyRef.current) return
    if (!(await confirmDialog({ title: 'このプロジェクトを削除しますか？', message: '作ったスライドも消え、元に戻せません。', confirmLabel: '削除する', tone: 'danger' }))) return
    if (deleteBusyRef.current) return
    deleteBusyRef.current = true
    setDeleteBusyId(id)
    setDeleteError(null)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(`/api/doyaslide/projects/${id}`, { method: 'DELETE', signal: controller.signal })
      const data = await res.json()
      if (!res.ok || data?.success !== true) throw new Error('削除結果を確認できませんでした。')
      toast.success('削除しました。')
      load()
    } catch {
      setDeleteError('削除結果を確認できませんでした。一覧を再読み込みして、プロジェクトが残っているかご確認ください。')
    } finally {
      window.clearTimeout(timer)
      deleteBusyRef.current = false
      setDeleteBusyId(null)
    }
  }

  return (
    <div className={uiNext ? 'p-4 lg:p-8 max-w-6xl mx-auto' : 'p-6 lg:p-10 max-w-6xl mx-auto'}>
      {deleteError && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{deleteError}</p><button onClick={load} className="mt-2 font-bold underline">一覧を再読み込み</button></div>}
      {uiNext ? (
        <div className="mb-6 space-y-4">
          {/* 見出しは枠（ToolFrame）の h1。ここは「何ができるか」と主ボタン1つ（UI 品質 H-3・S-57・S-58） */}
          <ToolHero
            title={<>テーマを入れるだけで、<wbr />提案スライドが<wbr />できあがります</>}
            lead={<>構成から1枚ずつの絵まで、<wbr />AIがまとめて作ります。<wbr />できたスライドは<wbr />あとから直せます。</>}
            action={<Button href="/doyaslide/new" icon="Plus">新しく作る</Button>}
            // 熊のキービジュアル（public/ui-renewal/mascots/doyaslide.webp）が置かれるまでは、操作画面の絵を出す
              art={toolHeroArt('doyaslide') ?? '/doyaslide/hero.webp'}
              artAlt=""
          />
          <FirstSteps
            id="doyaslide"
            steps={[
              { title: 'テーマを入れる', body: '何の資料か、誰に見せるかを一言で書きます' },
              { title: '構成を確かめる', body: 'AIが出した章立てを、必要なら直します' },
              { title: 'スライドを作る', body: '全スライドを画像で作り、PDF などで書き出せます' },
            ]}
          />
        </div>
      ) : (
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="sr-only">ドヤスライド プロジェクト一覧</h1>
            <img
              src="/doyaslide/logo.png"
              alt="ドヤスライド — SaaSサービス向けプレゼン作成ツール"
              className="h-14 sm:h-16 w-auto object-contain"
            />
            <p className="text-slate-500 font-bold mt-1 hidden sm:block">作成したプロジェクト一覧</p>
          </div>
        </div>
        <Link
          href="/doyaslide/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black shadow-lg hover:shadow-xl transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          新規作成
        </Link>
      </div>
      )}

      {usage?.limits && (
        <div className="mb-6 inline-flex items-center gap-3 text-xs font-bold text-slate-500 bg-white rounded-full px-4 py-2 shadow-sm">
          <span>プラン: {planLabel(usage.plan)}</span>
          <span className="text-slate-300">|</span>
          <span>
            今月のプロジェクト {usage.usage?.projects ?? 0}
            {usage.limits.maxProjects === -1 ? '' : ` / ${usage.limits.maxProjects}`}
          </span>
          <span className="text-slate-300">|</span>
          <span>
            今月の生成 {usage.usage?.slidesThisMonth ?? 0}
            {usage.limits.maxSlidesPerMonth === -1 ? '' : ` / ${usage.limits.maxSlidesPerMonth}枚`}
          </span>
        </div>
      )}
      {usageError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">利用状況を取得できませんでした。<button type="button" onClick={load} className="ml-2 underline">再読み込み</button></div>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : projectsError ? (
        <div role="alert" className="rounded-2xl bg-rose-50 p-6 text-center font-bold text-rose-700">プロジェクト一覧を取得できませんでした。<button type="button" onClick={load} className="ml-2 underline">再読み込み</button></div>
      ) : projects.length === 0 && uiNext ? (
        <div className="rounded-3xl border border-slate-200 bg-white">
          <DsEmptyState
            title="まだスライドがありません"
            description="テーマを入れるだけで、AIが全スライドを画像で作ります。"
            art="/doyaslide/empty-slides.webp"
            action={<Button href="/doyaslide/new" variant="secondary" icon="Plus">最初のスライドを作る</Button>}
          />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl bg-white shadow-sm">
          <EmptyState kind="not-generated" title="最初のスライドを作りましょう" description="テーマを入れるだけで、AIが全スライドを画像で作ります。" action={<Link href="/doyaslide/new" className="inline-flex rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 font-black text-white shadow-lg">最初のスライドを作る</Link>} />
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const cover = p.coverUrl
            return (
              <div key={p.id} className="group bg-white rounded-3xl shadow-sm hover:shadow-lg transition-all overflow-hidden">
                <Link href={`/doyaslide/${p.id}`}>
                  <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                    {cover ? (
                      <img src={doyaslideImageSrc(cover)} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      uiNext ? <ImageIcon size={40} strokeWidth={1.5} aria-hidden className="text-slate-300" /> : <span className="text-4xl opacity-30">🖼️</span>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/doyaslide/${p.id}`} className="font-black text-slate-800 truncate hover:underline">
                      {p.title}
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      disabled={deleteBusyId !== null}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      {uiNext ? <Trash2 size={18} aria-hidden /> : <span className="material-symbols-outlined text-lg">delete</span>}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-400">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                    <span>{p.generatedSlides}枚</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {nextCursor && <div className="mt-6 text-center"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="rounded-full border border-indigo-300 px-6 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50">{loadingMore ? '読み込み中…' : `さらに表示（${projects.length}/${total}件）`}</button></div>}
        </>
      )}
    </div>
  )
}
