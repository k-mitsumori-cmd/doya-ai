'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Clock, Loader2, Mic, PlusCircle, RotateCcw, Sparkles, UploadCloud, Users, X, XCircle } from 'lucide-react'
import InterviewUpsellModal from '@/components/interview/InterviewUpsellModal'
import { createInterviewProjectRequest, readInterviewCreationResponse, InterviewCreationResponseError } from '@/lib/interview/creation-response'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { findInterviewUploadAttempt } from '@/lib/interview/upload-attempt'
import { EmptyState, Skeleton, ToolHero } from '@/components/ds'
import { ErrorNotice } from '@/components/ds/feedback'

// 新しい見た目のキービジュアル。シロクマの絵（public/ui-renewal/mascots/interview.webp）が置かれるまでは、LP の画面の絵を仮に出す
const HERO_ART = '/ui-renewal/keyart/interview.webp'

interface Project {
  id: string
  title: string
  status: string
  intervieweeName: string | null
  genre: string | null
  thumbnailUrl?: string | null
  materialCount: number
  draftCount: number
  articleTitle?: string | null
  articleSummary?: string | null
  transcriptionSummary?: string | null
  transcriptionExcerpt?: string | null
  createdAt: string
  updatedAt: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'creating' | 'uploading' | 'confirming' | 'transcribing' | 'done' | 'error'
  error?: string
  errorActionUrl?: string
  errorActionLabel?: string
  materialId?: string
  projectId?: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
  PLANNING: { label: '企画中', color: 'bg-brand-50 text-brand-500 border border-brand-100' },
  TRANSCRIBING: { label: '処理中', color: 'bg-amber-50 text-amber-600 border border-amber-200' },
  EDITING: { label: '編集中', color: 'bg-blue-50 text-blue-600 border border-blue-200' },
  REVIEWING: { label: 'レビュー中', color: 'bg-indigo-50 text-indigo-600 border border-indigo-200' },
  COMPLETED: { label: '完了', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
}

const GENRE_COLORS: Record<string, string> = {
  CASE_STUDY: 'from-blue-400 to-indigo-500',
  PRODUCT_INTERVIEW: 'from-emerald-400 to-teal-500',
  PERSONA_INTERVIEW: 'from-brand-300 to-brand-400',
  PANEL_DISCUSSION: 'from-amber-400 to-orange-500',
  EVENT_REPORT: 'from-rose-400 to-brand-600',
  OTHER: 'from-slate-400 to-slate-500',
}

const pageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const UPLOAD_STEPS = [
  { key: 'creating', label: 'プロジェクト作成', icon: 'folder_open', activeIcon: 'create_new_folder' },
  { key: 'uploading', label: 'アップロード中', icon: 'cloud_upload', activeIcon: 'cloud_sync' },
  { key: 'confirming', label: '確認処理', icon: 'verified', activeIcon: 'pending' },
  { key: 'transcribing', label: '文字起こし開始', icon: 'mic', activeIcon: 'graphic_eq' },
  { key: 'done', label: '完了', icon: 'check_circle', activeIcon: 'celebration' },
]

const UPLOAD_TIPS = [
  { icon: 'auto_awesome', text: 'AIが音声を文字起こしします。結果は編集して整えられます' },
  { icon: 'speed', text: '処理時間は音声の長さや混雑状況によって変わります' },
  { icon: 'mic', text: '複数の話者がいても、AIが自動で話者を分離します' },
  { icon: 'article', text: '文字起こし結果からプロ品質の記事を自動生成します' },
  { icon: 'edit_note', text: '生成された記事はエディタで自由に編集できます' },
  { icon: 'fact_check', text: 'ファクトチェック機能で信頼性を自動検証します' },
  { icon: 'share', text: 'SNS投稿文の自動生成で、記事の拡散も簡単です' },
  { icon: 'translate', text: '10言語への翻訳機能で、グローバル展開も対応' },
]

const FLOATING_ICONS = ['mic', 'description', 'auto_awesome', 'movie', 'music_note', 'lightbulb', 'bolt', 'local_fire_department', 'rocket_launch', 'favorite']

export default function InterviewTool() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadSpeedRef = useRef<Map<string, { startTime: number; lastLoaded: number; speed: number }>>(new Map())
  const xhrRef = useRef<Map<string, XMLHttpRequest>>(new Map())
  const resolvedActor = String(session?.user?.id || 'guest')
  const lastResolvedActor = useRef(resolvedActor)
  const uploadActor = sessionStatus === 'loading' ? lastResolvedActor.current : resolvedActor
  const uploadActorRef = useRef(uploadActor)
  const uploadLifecycle = useRef(new AbortController())
  const dashboardAttempts = useRef<Map<string, { uploadKey: string; creation: { key: string; scope: string | null }; controller: AbortController | null; projectId?: string; material?: { signedUrl: string; materialId: string }; uploaded?: boolean; completed?: boolean }>>(new Map())
  const uploadsAlive = useRef(true)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectListError, setProjectListError] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map())
  const [comparingCount, setComparingCount] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    uploadsAlive.current = true
    uploadActorRef.current = uploadActor
    uploadLifecycle.current = new AbortController()
    const lifecycle = uploadLifecycle.current
    dashboardAttempts.current = new Map()
    setUploads(new Map())
    setComparingCount(0)
    const attempts = dashboardAttempts.current
    const activeXhrs = xhrRef.current
    return () => {
      uploadsAlive.current = false
      lifecycle.abort()
      uploadLifecycle.current.abort()
      for (const attempt of attempts.values()) attempt.controller?.abort()
      for (const xhr of activeXhrs.values()) xhr.abort()
    }
  }, [uploadActor])

  useEffect(() => {
    if (sessionStatus !== 'loading') lastResolvedActor.current = resolvedActor
    if (sessionStatus === 'loading') {
      uploadLifecycle.current.abort()
      for (const attempt of dashboardAttempts.current.values()) attempt.controller?.abort()
      setComparingCount(0)
      setUploads(prev => new Map(Array.from(prev, ([key, item]) => [key,
        item.status === 'done' || item.status === 'error' ? item : { ...item, status: 'error' as const,
          error: '利用情報を確かめています。確かめ終わったら、もう一度お試しください。',
          errorActionUrl: '/interview/projects', errorActionLabel: '保存されたプロジェクトを確認する' },
      ])))
    } else if (uploadLifecycle.current.signal.aborted) uploadLifecycle.current = new AbortController()
  }, [sessionStatus, resolvedActor, uploadActor])

  // アップセルモーダル
  const [upsellOpen, setUpsellOpen] = useState(false)
  const [upsellLimitType, setUpsellLimitType] = useState<'transcription' | 'upload' | 'generation'>('generation')
  const [upsellIsGuest, setUpsellIsGuest] = useState(false)

  // 利用者切り替え・画面離脱後の古い一覧応答は反映しない。
  useEffect(() => {
    const controller = new AbortController()
    setProjects([])
    setProjectListError(false)
    if (uploadActor === 'loading' || sessionStatus === 'loading') {
      setLoading(true)
      return () => controller.abort()
    }
    if (uploadActor === 'guest') {
      setLoading(false)
      return () => controller.abort()
    }
    setLoading(true)
    void readInterviewCreationResponse('/api/interview/projects', {
      signal: controller.signal, cache: 'no-store',
    }, 'プロジェクト一覧を取得できませんでした。', 4 * 1024 * 1024)
      .then(({ res, data }) => {
        if (controller.signal.aborted) return
        if (!res.ok || data?.success !== true || !Array.isArray(data.projects)) throw new Error('Project list unavailable')
        setProjects(data.projects)
        setProjectListError(false)
      })
      .catch(() => { if (!controller.signal.aborted) setProjectListError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [uploadActor, sessionStatus])

  // 豆知識サイクル — uploads.size でシンプルに判定
  const uploadsExist = uploads.size > 0 || comparingCount > 0

  useEffect(() => {
    if (!uploadsExist) return
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % UPLOAD_TIPS.length), 4000)
    return () => clearInterval(interval)
  }, [uploadsExist])

  // ブラウザ離脱防止
  useEffect(() => {
    if (!uploadsExist) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploadsExist])

  const recentProjects = projects.slice(0, 6)

  // ファイルからプロジェクト名を生成
  const getProjectTitle = (file: File) => {
    const name = file.name.replace(/\.[^/.]+$/, '')
    return name.replace(/[_-]/g, ' ').trim() || '新規インタビュー'
  }

  // ダッシュボードからのアップロード: プロジェクト自動作成 → アップロード → 文字起こし
  const uploadFromDashboard = useCallback(async (file: File) => {
    if (sessionStatus === 'loading' || uploadActor === 'loading' || !uploadsAlive.current || uploadActorRef.current !== uploadActor) return
    const lifecycle = uploadLifecycle.current
    let operation: (typeof dashboardAttempts.current extends Map<string, infer T> ? T : never)
    try {
      const found = findInterviewUploadAttempt(file, dashboardAttempts.current, () => ({
        uploadKey: crypto.randomUUID(), creation: { key: crypto.randomUUID(), scope: null }, controller: null,
      }), lifecycle.signal)
      if ('then' in found) {
        setComparingCount(count => count + 1)
        try { operation = await found } finally {
          if (uploadsAlive.current && uploadActorRef.current === uploadActor && uploadLifecycle.current === lifecycle && !lifecycle.signal.aborted) setComparingCount(count => Math.max(0, count - 1))
        }
      } else operation = found
    } catch {
      if (uploadsAlive.current && uploadActorRef.current === uploadActor && uploadLifecycle.current === lifecycle && !lifecycle.signal.aborted) {
        setUploads(prev => new Map(prev).set(crypto.randomUUID(), { file, progress: 0, status: 'error',
          error: 'ファイルの中身を確かめられませんでした。もう一度お試しください。' }))
      }
      return
    }
    if (!uploadsAlive.current || uploadActorRef.current !== uploadActor || uploadLifecycle.current !== lifecycle || lifecycle.signal.aborted) return
    if (operation?.controller || operation?.completed) return
    const record = operation
    const active = new AbortController()
    record.controller = active
    const isCurrent = () => uploadsAlive.current && uploadActorRef.current === uploadActor && record.controller === active && !active.signal.aborted
    const uploadKey = record.uploadKey
    const title = getProjectTitle(file).slice(0, 200)
    const rejectUploadPreparation = (data: { code?: string; error?: string; actionUrl?: string; actionLabel?: string }) => {
      if (data.code === 'GUEST_UPLOAD_LIMIT' || (data.code === 'PLAN_UPLOAD_LIMIT' && data.actionUrl === '/interview/pricing')) {
        setUpsellLimitType('upload')
        setUpsellIsGuest(data.code === 'GUEST_UPLOAD_LIMIT')
        setUpsellOpen(true)
      }
      const publicMessages: Record<string, string> = { GUEST_UPLOAD_LIMIT: 'ゲストのアップロード容量上限に達しました。ログインして利用条件をご確認ください。', PLAN_UPLOAD_LIMIT: 'プランのアップロード容量上限に達しました。利用条件をご確認ください。', STORAGE_UPLOAD_LIMIT: '保存領域の容量上限を超えています。ファイルを分割または圧縮してください。' }
      const err: any = new InterviewCreationResponseError(publicMessages[data.code || ''] || 'アップロード準備の結果を確認できませんでした。プロジェクト一覧から確認してください。')
      err.actionUrl = ['/interview/pricing', '/auth/signin?callbackUrl=/interview', SUPPORT_CONTACT_URL].includes(data.actionUrl || '') ? data.actionUrl : '/interview/projects'
      err.actionLabel = err.actionUrl === '/interview/pricing' ? 'プランと利用条件を確認する' : err.actionUrl === SUPPORT_CONTACT_URL ? '追加の利用枠を相談する' : err.actionUrl === '/interview/projects' ? 'プロジェクト一覧を確認する' : 'ログインして続ける'
      throw err
    }

    setUploads((prev) => {
      const next = new Map(prev)
      next.set(uploadKey, { file, progress: 0, status: 'creating' })
      return next
    })

    try {
      // ファイル形式と実効容量を先に確認し、上限超過で空のプロジェクトを作らない。
      const preflight = await readInterviewCreationResponse('/api/interview/materials/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.signal,
        body: JSON.stringify({ preflight: true, fileName: file.name, mimeType: file.type, fileSize: file.size }),
      }, 'アップロードの利用条件を確認できませんでした。時間を置いて再度お試しください。')
      if (!isCurrent()) return
      if (!preflight.res.ok || preflight.data?.success !== true) rejectUploadPreparation(preflight.data || {})
      // Reuse the saved project after a later upload failure; do not create another empty project.
      if (!record.projectId) {
        const project = await createInterviewProjectRequest({ title }, record.creation, active.signal)
        if (!isCurrent()) return
        record.projectId = project.id
      }
      const projectId = record.projectId

      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'uploading', projectId })
        return next
      })

      // Step 2: 署名付きURL取得
      if (!record.uploaded) {
        const urlReply = await readInterviewCreationResponse('/api/interview/materials/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.signal,
          body: JSON.stringify({ projectId, requestKey: uploadKey, fileName: file.name, mimeType: file.type, fileSize: file.size, ...(record.material ? { materialId: record.material.materialId } : {}) }),
        }, 'アップロード準備の結果を確認できませんでした。プロジェクト一覧から確認してください。')
        if (!isCurrent()) return
        const urlData = urlReply.data
        if (!urlReply.res.ok || urlData?.success !== true) rejectUploadPreparation(urlData || {})
        const { signedUrl, materialId } = urlData
        if (typeof materialId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(materialId) || typeof signedUrl !== 'string') throw new InterviewCreationResponseError('アップロード先を確認できませんでした。プロジェクト一覧から確認してください。')
        let uploadUrl: URL
        try { uploadUrl = new URL(signedUrl) } catch { throw new InterviewCreationResponseError('アップロード先を確認できませんでした。') }
        if (uploadUrl.protocol !== 'https:' || uploadUrl.username || uploadUrl.password) throw new InterviewCreationResponseError('アップロード先を確認できませんでした。')
        if (record.material && record.material.materialId !== materialId) throw new InterviewCreationResponseError('保存先が変更されました。プロジェクト一覧から確認してください。')
        record.material = { signedUrl, materialId }
      }
      if (!record.material) throw new InterviewCreationResponseError('アップロード先を確認できませんでした。')
      const { signedUrl, materialId } = record.material

      // Step 3: Supabase Storage へ直接PUT (リトライ付き)
      const maxRetries = 3
      for (let attempt = 1; !record.uploaded && attempt <= maxRetries; attempt++) {
        if (!isCurrent()) return
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhrRef.current.set(uploadKey, xhr)

            xhr.upload.addEventListener('progress', (e) => {
              if (!isCurrent()) return
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100)
                // 速度計算
                const speedInfo = uploadSpeedRef.current.get(uploadKey)
                if (speedInfo) {
                  const elapsed = (Date.now() - speedInfo.startTime) / 1000
                  if (elapsed > 0) {
                    speedInfo.speed = e.loaded / elapsed
                    speedInfo.lastLoaded = e.loaded
                  }
                } else {
                  uploadSpeedRef.current.set(uploadKey, { startTime: Date.now(), lastLoaded: e.loaded, speed: 0 })
                }
                setUploads((prev) => {
                  const next = new Map(prev)
                  const item = next.get(uploadKey)
                  if (item) next.set(uploadKey, { ...item, progress, materialId })
                  return next
                })
              }
            })

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve()
              } else {
                // 画面に出す文は日本語にし、状態コードは再試行の判定のためだけに持つ（UX 点検 FIX-PLAN 17）
                const err: any = new Error('ファイルを送れませんでした。もう一度お試しください。')
                err.httpStatus = xhr.status
                reject(err)
              }
            })
            xhr.addEventListener('error', () => reject(new Error('通信が切れました。通信を確かめて、もう一度お試しください。')))
            xhr.addEventListener('abort', () => {
              const err: any = new Error('アップロードをキャンセルしました')
              err.cancelled = true
              reject(err)
            })

            const formData = new FormData()
            formData.append('cacheControl', '3600')
            formData.append('', file, file.name)
            const abortUpload = () => xhr.abort()
            active.signal.addEventListener('abort', abortUpload, { once: true })
            xhr.addEventListener('loadend', () => active.signal.removeEventListener('abort', abortUpload))
            xhr.timeout = 3600000
            xhr.addEventListener('timeout', () => reject(new InterviewCreationResponseError('アップロードの完了を確認できませんでした。プロジェクト一覧から確認してください。')))
            xhr.open('PUT', signedUrl)
            xhr.setRequestHeader('x-upsert', 'true')
            xhr.send(formData)
          })
          if (!isCurrent()) return
          record.uploaded = true
          break // 成功したらループを抜ける
        } catch (uploadErr: any) {
          if (!isCurrent()) return
          const is5xx = typeof uploadErr?.httpStatus === 'number' && uploadErr.httpStatus >= 500 && uploadErr.httpStatus < 600
          if (is5xx && attempt < maxRetries) {
            console.warn(`[interview] Upload attempt ${attempt} failed, retrying in ${attempt * 3}s...`)
            // プログレスをリセットして再試行
            setUploads((prev) => {
              const next = new Map(prev)
              const item = next.get(uploadKey)
              if (item) next.set(uploadKey, { ...item, progress: 0 })
              return next
            })
            uploadSpeedRef.current.delete(uploadKey)
            await new Promise(r => setTimeout(r, attempt * 3000))
            continue
          }
          throw uploadErr
        }
      }

      // XHRの参照をクリーンアップ
      xhrRef.current.delete(uploadKey)

      // Step 4: アップロード確認
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'confirming', progress: 100 })
        return next
      })

      if (!isCurrent()) return
      const confirm = await readInterviewCreationResponse('/api/interview/materials/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.signal,
        body: JSON.stringify({ materialId }),
      }, '素材の保存結果を確認できませんでした。プロジェクト一覧から確認してください。')
      if (!isCurrent()) return
      if (!confirm.res.ok || confirm.data?.success !== true) throw new InterviewCreationResponseError('素材の保存確認が完了していません。プロジェクト一覧から確認してください。')
      record.completed = true

      // Step 5: 音声/動画ならリアルタイム文字起こしページへ遷移
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/')
      if (isAudioVideo && materialId) {
        setUploads((prev) => {
          const next = new Map(prev)
          const item = next.get(uploadKey)
          if (item) next.set(uploadKey, { ...item, status: 'done' })
          return next
        })

        // リアルタイム文字起こしページへ遷移
        router.push(`/interview/projects/${encodeURIComponent(projectId)}/transcribe?materialId=${encodeURIComponent(materialId)}`)
        return
      }

      // 完了
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'done' })
        return next
      })

      // 保存は完了済み。一覧の取得失敗をアップロード失敗に戻さない。
      try {
        const refresh = await readInterviewCreationResponse('/api/interview/projects', {
          signal: active.signal,
        }, 'プロジェクト一覧を取得できませんでした。', 4 * 1024 * 1024)
        if (!isCurrent()) return
        if (!refresh.res.ok || refresh.data?.success !== true || !Array.isArray(refresh.data.projects)) {
          setProjectListError(true)
        } else {
          setProjects(refresh.data.projects)
          setProjectListError(false)
        }
      } catch {
        if (!isCurrent()) return
        setProjectListError(true)
      }

      // 5秒後にアップロード表示を消す
      setTimeout(() => {
        if (!uploadsAlive.current || uploadActorRef.current !== uploadActor) return
        setUploads((prev) => {
          const next = new Map(prev)
          next.delete(uploadKey)
          return next
        })
      }, 5000)
    } catch (e: any) {
      if (!isCurrent()) return
      if (e instanceof InterviewCreationResponseError && e.code === 'CREATION_SCOPE_CHANGED') { record.creation = { key: crypto.randomUUID(), scope: null }; record.projectId = undefined; record.material = undefined; record.uploaded = false }
      if (e instanceof InterviewCreationResponseError && (e.code === 'GUEST_LIMIT' || e.code === 'AUTH_REQUIRED')) { Object.assign(e, { actionUrl: '/auth/signin?callbackUrl=/interview', actionLabel: 'ログインして続ける' }) }
      // キャンセル時はエラー表示せずクリーンアップのみ
      if (e.cancelled) {
        xhrRef.current.delete(uploadKey)
        uploadSpeedRef.current.delete(uploadKey)
        setUploads((prev) => {
          const next = new Map(prev)
          next.delete(uploadKey)
          return next
        })
        return
      }
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, {
          ...item,
          status: 'error',
          error: e instanceof InterviewCreationResponseError ? e.message : '処理結果を確認できませんでした。プロジェクト一覧から確認してください。',
          errorActionUrl: e.actionUrl || `/interview/projects${record.projectId ? '/' + encodeURIComponent(record.projectId) + '/materials' : ''}`,
          errorActionLabel: e.actionLabel || '保存されたプロジェクトを確認する',
        })
        return next
      })
    } finally {
      if (record.controller === active) record.controller = null
    }
  }, [router, uploadActor, sessionStatus])

  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      uploadFromDashboard(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  const getProjectLink = (p: Project) => {
    if (p.draftCount > 0) return `/interview/projects/${p.id}/edit`
    if (p.materialCount > 0) return `/interview/projects/${p.id}/skill`
    return `/interview/projects/${p.id}/materials`
  }

  const getStatusLabel = (status: string) => {
    if (status === 'TRANSCRIBING' || status === 'PLANNING' || status === 'RECORDING') {
      return { label: '処理中', color: 'bg-amber-50 text-amber-600 border border-amber-200' }
    }
    if (status === 'COMPLETED' || status === 'EDITING' || status === 'REVIEWING') {
      return { label: '完了', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200' }
    }
    return STATUS_LABELS[status] || STATUS_LABELS.DRAFT
  }

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-8"
      variants={pageVariants}
      // ⚠️ 新しい見た目では、最初の HTML を透明にしない（JS の読み込みが終わるまで本文が見えなかった）
      initial={false}
      animate="show"
    >
      <>
          <ToolHero
            title={<>取材の音声から、<wbr />記事の下書きまで</>}
            lead="録音・録画のファイルを入れるだけで、話者を分けて文字に起こし、AIがインタビュー記事を書きます。"
            art={HERO_ART}
            artAlt="ドヤインタビューAIの文字起こしの画面"
          />
        </>

      {/* Upload Zone Card */}
      <motion.div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        initial={false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="p-4 sm:p-8 md:p-12">
          {sessionStatus === 'loading' && <p role="status" className="mb-4 text-sm text-slate-600">利用情報を確認しています。確認後にファイルを選択できます。</p>}
          {comparingCount > 0 && <p role="status" className="mb-4 text-sm text-slate-600">同じ名前のファイルの内容を確認しています。大きなファイルは時間がかかる場合があります。</p>}
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (sessionStatus !== 'loading') setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { if (sessionStatus !== 'loading') fileInputRef.current?.click() }}
            aria-disabled={sessionStatus === 'loading'}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-8 sm:py-14 px-4 sm:px-6 transition-all cursor-pointer group ${
              dragOver
                ? 'border-[#0066ff] bg-[#0066ff]/10 scale-[1.01]'
                : 'border-[#0066ff]/25 bg-[#0066ff]/[0.03] hover:bg-[#0066ff]/[0.06] hover:border-[#0066ff]/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={sessionStatus === 'loading'}
              accept=".mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.mov,.avi,.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
            />
            <div className="w-14 h-14 bg-[#0066ff] rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg shadow-[#0066ff]/20">
              <UploadCloud className="h-7 w-7 text-white" aria-hidden />
            </div>
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-1.5 text-center">インタビュー記事を作成する</h3>
            <p className="text-slate-500 text-xs sm:text-sm mb-6 text-center">
              動画・音声ファイルをドラッグ&ドロップ。MP4, MOV, MP3 最大10GBまで
            </p>
            <span className="bg-[#0066ff] text-white px-6 sm:px-8 py-3 rounded-xl font-black text-sm hover:bg-[#0047d6] transition-all shadow-lg shadow-[#0066ff]/25 inline-flex items-center gap-2 min-h-[44px]">
              <PlusCircle className="h-[18px] w-[18px]" aria-hidden />
              ファイルを選択
            </span>
          </div>

          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <Users className="h-5 w-5 text-[#0066ff]" aria-hidden />
              <div>
                <p className="text-xs font-black text-slate-900">話者分離</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動対応</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[44px]">
              <Sparkles className="h-5 w-5 text-[#0066ff]" aria-hidden />
              <div>
                <p className="text-xs font-black text-slate-900">AI記事下書き</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">自動生成</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 新しい見た目: アップロードの進み具合は画面を覆わず、アップロードの枠の下に出す（UX 点検 FIX-PLAN 13） */}
      {uploads.size > 0 && (() => {
        const allUploads = Array.from(uploads.entries())
        const active = allUploads.filter(([, u]) => u.status !== 'done' && u.status !== 'error')
        const done = allUploads.filter(([, u]) => u.status === 'done')
        const allDone = active.length === 0 && done.length > 0
        const statusText = (u: UploadingFile) =>
          u.status === 'creating' ? 'プロジェクトを作っています'
            : u.status === 'uploading' ? `送っています（${u.progress}%）`
            : u.status === 'confirming' ? '保存を確かめています'
            : u.status === 'transcribing' ? '文字起こしを始めています'
            : u.status === 'done' ? '完了しました'
            : u.error || 'ファイルを送れませんでした。もう一度お試しください。'
        return (
          <section aria-label="アップロードの進み具合" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              {allDone
                ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden />
                : active.length > 0 ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#0066ff]" aria-hidden /> : <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" aria-hidden />}
              {allDone ? 'アップロードが終わりました。文字起こしは裏で進みます。' : active.length > 0 ? 'アップロードしています。このページを開いたままにしてください。' : 'アップロードできなかったファイルがあります。'}
            </p>
            <ul className="mt-3 space-y-3">
              {allUploads.map(([key, upload]) => {
                const isError = upload.status === 'error'
                const isDone = upload.status === 'done'
                const pct = isDone || upload.status === 'confirming' || upload.status === 'transcribing' ? 100 : upload.status === 'creating' ? 0 : upload.progress
                return (
                  <li key={key} className={`rounded-xl border p-3 ${isError ? 'border-red-200 bg-red-50' : isDone ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{upload.file.name}</p>
                        <p className={`text-xs font-bold ${isError ? 'text-red-700' : isDone ? 'text-green-700' : 'text-slate-600'}`}>
                          {formatFileSize(upload.file.size)} · {statusText(upload)}
                        </p>
                      </div>
                      {upload.status === 'uploading' && (
                        <button
                          type="button"
                          onClick={() => { const xhr = xhrRef.current.get(key); if (xhr) xhr.abort() }}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label={`${upload.file.name} のアップロードをやめる`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    {!isError && (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${upload.file.name} の進み具合`}>
                        <div className={`h-full rounded-full transition-all ${isDone ? 'bg-green-500' : 'bg-[#0066ff]'}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {isError && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const file = upload.file
                            setUploads((prev) => { const next = new Map(prev); next.delete(key); return next })
                            uploadFromDashboard(file)
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden />
                          もう一度送る
                        </button>
                        {upload.errorActionUrl && (
                          <a href={upload.errorActionUrl} className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 hover:bg-slate-50">
                            {upload.errorActionLabel || '詳しく見る'}
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {allDone && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setUploads(new Map()); uploadSpeedRef.current.clear(); xhrRef.current.clear() }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  閉じる
                </button>
                {done[0]?.[1]?.projectId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/interview/projects/${done[0][1].projectId}/materials`)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0066ff] px-4 text-sm font-bold text-white hover:bg-[#0047d6]"
                  >
                    プロジェクトを開く
                  </button>
                )}
              </div>
            )}
          </section>
        )
      })()}

      {/* Upload Progress Modal — createPortal でビューポート直下にレンダリング（今の見た目だけ） */}

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-700" aria-hidden />
            <h2 className="text-lg font-black text-slate-900">最近のプロジェクト</h2>
          </div>
          {session?.user && (
            <Link
              href="/interview/projects"
              className="text-sm font-bold text-[#0066ff] hover:underline py-2 min-h-[44px] inline-flex items-center"
            >
              すべて表示
            </Link>
          )}
        </div>

        {!session?.user ? (
          <div className="bg-white rounded-xl p-6 sm:p-12 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-[#0066ff]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#0066ff] text-3xl">lock</span>
            </div>
            <p className="text-slate-900 font-bold mb-1">ログインしてプロジェクトを管理</p>
            <p className="text-slate-500 text-sm mb-4">ログイン後に作成したプロジェクトの一覧を閲覧・管理できます</p>
            <Link
              href="/auth/signin?callbackUrl=/interview"
              className="inline-flex items-center gap-2 bg-[#0066ff] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#0047d6] transition-all shadow-lg shadow-[#0066ff]/25 min-h-[44px]"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              ログインする
            </Link>
          </div>
        ) : loading ? (
          // 読み込みの間も、一覧と同じ高さを取っておく（読み込み後に下の中身が動かないように）
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-h-[84px] rounded-xl border border-slate-200 bg-white p-4"><Skeleton lines={2} delayMs={0} /></div>
            ))}
          </div>
        ) : projectListError ? (
          <ErrorNotice what="プロジェクトの一覧を読み込めませんでした。" how="通信の状態を確かめて、もう一度読み込んでください。" onRetry={() => window.location.reload()} retryLabel="読み込み直す" />
        ) : projectListError ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
            プロジェクト一覧を読み込めませんでした。
            <button type="button" onClick={() => window.location.reload()} className="ml-2 font-bold underline underline-offset-2">再読み込み</button>
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <EmptyState
              kind="not-generated"
              art="/interview/empty-interviews.webp"
              title="まだプロジェクトがありません"
              description="取材の音声か動画のファイルを、上の枠に入れると最初のプロジェクトができます。"
            />
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="bg-white rounded-xl p-6 sm:p-12 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-[#0066ff]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#0066ff] text-3xl">mic</span>
            </div>
            <p className="text-slate-900 font-bold mb-1">まだプロジェクトがありません</p>
            <p className="text-slate-500 text-sm">上のエリアからファイルをアップロードして始めましょう</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={containerVariants}
            initial={false}
            animate="show"
          >
            {recentProjects.map((project) => {
              const status = getStatusLabel(project.status)
              const gradient = GENRE_COLORS[project.genre || ''] || GENRE_COLORS.OTHER

              return (
                <motion.div key={project.id} variants={cardVariants}>
                  <Link
                    href={getProjectLink(project)}
                    className="group bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 sm:gap-3.5 hover:border-[#0066ff]/30 hover:shadow-md transition-all min-h-[44px]"
                  >
                    {/* Thumbnail */}
                    {project.thumbnailUrl ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                        <Mic className="h-5 w-5 text-white/80" aria-hidden />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-bold text-slate-900 truncate !whitespace-nowrap group-hover:text-[#0066ff] transition-colors flex-1">
                          {project.articleTitle || project.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {/* 文字起こし要約 */}
                      {(project.transcriptionSummary || project.transcriptionExcerpt) && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-1">
                          <Mic className="mr-0.5 inline h-2.5 w-2.5 align-middle text-[#0066ff]" aria-hidden />
                          {project.transcriptionSummary || project.transcriptionExcerpt}
                        </p>
                      )}
                      {/* 記事サマリー */}
                      {project.articleSummary && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-1">
                          {project.articleSummary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold">
                        <span>{getTimeSince(project.updatedAt)}</span>
                        {project.materialCount > 0 && (
                          <>
                            <span>·</span>
                            <span>素材 {project.materialCount}件</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
      {/* アップセルモーダル */}
      <InterviewUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        limitType={upsellLimitType}
        isGuest={upsellIsGuest}
      />
    </motion.div>
  )
}
