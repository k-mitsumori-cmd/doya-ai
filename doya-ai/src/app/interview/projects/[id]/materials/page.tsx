'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// 5GB超ファイル対応 — 直接アップロードUI
// ============================================
// フロー:
// 1. ファイル選択 (ドラッグ&ドロップ / ボタン)
// 2. API → 署名付きアップロードURL取得 (数KB, 高速)
// 3. ブラウザ → Supabase Storage へ直接PUT (Vercel経由しない)
// 4. API → アップロード完了確認 → DBに保存
// これにより Vercel の 4.5MB ボディサイズ制限を完全回避

interface MaterialItem {
  id: string
  type: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  status: string
  error: string | null
  createdAt: string
  transcriptionStatus?: string
}

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'confirming' | 'done' | 'error'
  error?: string
  materialId?: string
}

interface TranscriptionProgress {
  startTime: number
  materialId: string
  fileName: string
  fileSize: number | null
  status: 'starting' | 'processing' | 'completed' | 'error'
  error?: string
}

const TRANSCRIPTION_STEPS = [
  { label: 'ファイル取得', icon: 'cloud_download', timeThreshold: 0 },
  { label: '音声解析', icon: 'graphic_eq', timeThreshold: 5 },
  { label: 'テキスト変換', icon: 'text_fields', timeThreshold: 15 },
  { label: '結果保存', icon: 'check_circle', timeThreshold: 45 },
]

const STATUS_ICONS: Record<string, string> = {
  UPLOADED: 'schedule',
  PROCESSING: 'sync',
  COMPLETED: 'check_circle',
  ERROR: 'error',
}

const FILE_TYPE_ICONS: Record<string, string> = {
  audio: 'music_note',
  video: 'movie',
  pdf: 'description',
  text: 'article',
  image: 'image',
}


const UPLOAD_TIPS = [
  { icon: 'auto_awesome', text: 'AI文字起こしは95%以上の精度で音声をテキスト化します' },
  { icon: 'speed', text: '30分の音声ファイルでも約1〜2分で文字起こしが完了します' },
  { icon: 'mic', text: '複数の話者がいる場合も、AIが自動で話者を分離します' },
  { icon: 'translate', text: '日本語・英語をはじめ、多言語の文字起こしに対応しています' },
  { icon: 'article', text: '文字起こし結果からAIが自動でプロ品質の記事を生成します' },
  { icon: 'edit_note', text: '生成された記事はエディタで自由に編集・カスタマイズできます' },
  { icon: 'fact_check', text: 'ファクトチェック機能で記事の信頼性を自動検証します' },
  { icon: 'share', text: 'SNS投稿文の自動生成で、記事の拡散も簡単です' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } }
}

export default function MaterialsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [projectTitle, setProjectTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [transcribing, setTranscribing] = useState<Map<string, TranscriptionProgress>>(new Map())
  const [elapsedTick, setElapsedTick] = useState(0) // 経過時間更新用
  const [tipIndex, setTipIndex] = useState(0)

  // プロジェクトと素材一覧を取得
  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/interview/projects/${projectId}`)
      const data = await res.json()
      if (data.success) {
        setProjectTitle(data.project.title)
        setMaterials(
          data.project.materials.map((m: any) => ({
            ...m,
            transcriptionStatus: data.project.transcriptions?.find(
              (t: any) => t.materialId === m.id
            )?.status,
          }))
        )
      }
    } catch {
      // エラーは無視
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  // 素材にPROCESSINGがある場合はポーリング
  useEffect(() => {
    const hasProcessing = materials.some(
      (m) => m.status === 'PROCESSING' || m.transcriptionStatus === 'PROCESSING'
    )
    if (!hasProcessing) return

    const interval = setInterval(fetchProject, 5000)
    return () => clearInterval(interval)
  }, [materials, fetchProject])

  // 文字起こし完了時にtranscribingから削除
  useEffect(() => {
    setTranscribing((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const [id, info] of next) {
        const mat = materials.find((m) => m.id === id)
        if (mat && mat.transcriptionStatus === 'COMPLETED') {
          next.set(id, { ...info, status: 'completed' })
          changed = true
          // 3秒後に削除
          setTimeout(() => {
            setTranscribing((p) => {
              const n = new Map(p)
              n.delete(id)
              return n
            })
          }, 3000)
        } else if (mat && mat.transcriptionStatus === 'ERROR') {
          next.set(id, { ...info, status: 'error', error: mat.error || '文字起こしに失敗しました' })
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [materials])

  // 経過時間を毎秒更新
  useEffect(() => {
    if (transcribing.size === 0) return
    const hasActive = Array.from(transcribing.values()).some(
      (t) => t.status === 'starting' || t.status === 'processing'
    )
    if (!hasActive) return

    const interval = setInterval(() => setElapsedTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [transcribing])

  // アップロード中のブラウザ離脱防止
  useEffect(() => {
    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading' || u.status === 'confirming'
    )
    if (!hasActive) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploads])

  // 豆知識のサイクル
  useEffect(() => {
    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading' || u.status === 'confirming'
    )
    if (!hasActive) return
    const interval = setInterval(() => setTipIndex((i) => (i + 1) % UPLOAD_TIPS.length), 5000)
    return () => clearInterval(interval)
  }, [uploads])

  // 経過時間フォーマット
  const formatElapsed = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) return `${mins}分${secs.toString().padStart(2, '0')}秒`
    return `${secs}秒`
  }

  // 現在のステップを経過時間から推定
  const getCurrentStep = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    let step = 0
    for (let i = TRANSCRIPTION_STEPS.length - 1; i >= 0; i--) {
      if (seconds >= TRANSCRIPTION_STEPS[i].timeThreshold) {
        step = i
        break
      }
    }
    return step
  }

  // ============================================
  // 直接アップロード処理 (Vercelバイパス)
  // ============================================
  const uploadFile = async (file: File) => {
    const uploadKey = `${file.name}_${Date.now()}`

    setUploads((prev) => {
      const next = new Map(prev)
      next.set(uploadKey, { file, progress: 0, status: 'uploading' })
      return next
    })

    try {
      // Step 1: 署名付きアップロードURL取得 (API → 数KB)
      const urlRes = await fetch('/api/interview/materials/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })

      const urlData = await urlRes.json()
      if (!urlData.success) {
        throw new Error(urlData.error || 'アップロードURL取得失敗')
      }

      const { signedUrl, materialId } = urlData

      // Step 2: Supabase Storage へ直接PUT (Vercel経由しない!)
      // XMLHttpRequest で進捗トラッキング
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100)
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
            console.error('[upload] Supabase Storage error:', xhr.status, xhr.responseText)
            reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText || 'Unknown error'}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))
        xhr.addEventListener('abort', () => reject(new Error('アップロードが中断されました')))

        // Supabase Storage SDK と同じ FormData 形式
        const formData = new FormData()
        formData.append('cacheControl', '3600')
        formData.append('', file, file.name)

        xhr.open('PUT', signedUrl)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(formData)
      })

      // Step 3: アップロード完了確認 (API → DBに保存)
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'confirming', progress: 100 })
        return next
      })

      const confirmRes = await fetch('/api/interview/materials/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      })

      const confirmData = await confirmRes.json()
      if (!confirmData.success) {
        throw new Error(confirmData.error || '確認処理に失敗')
      }

      // 完了
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'done', materialId })
        return next
      })

      // 素材一覧を更新
      await fetchProject()

      // 音声/動画ファイルなら自動で文字起こしを開始
      const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/')
      if (isAudioVideo && materialId) {
        startTranscription(materialId)
      }

      // 3秒後にアップロード表示を消す
      setTimeout(() => {
        setUploads((prev) => {
          const next = new Map(prev)
          next.delete(uploadKey)
          return next
        })
      }, 3000)
    } catch (e: any) {
      setUploads((prev) => {
        const next = new Map(prev)
        const item = next.get(uploadKey)
        if (item) next.set(uploadKey, { ...item, status: 'error', error: e.message })
        return next
      })
    }
  }

  // ファイル選択ハンドラー
  const handleFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      uploadFile(file)
    }
  }

  // ドラッグ&ドロップ
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // 文字起こし開始
  const startTranscription = async (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId)

    // 即座にUI更新（ボタンクリック直後にフィードバック）
    setTranscribing((prev) => {
      const next = new Map(prev)
      next.set(materialId, {
        startTime: Date.now(),
        materialId,
        fileName: mat?.fileName || '',
        fileSize: mat?.fileSize || null,
        status: 'starting',
      })
      return next
    })

    try {
      const res = await fetch(`/api/interview/materials/${materialId}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      // API呼び出し後、processingに更新
      setTranscribing((prev) => {
        const next = new Map(prev)
        const info = next.get(materialId)
        if (info) next.set(materialId, { ...info, status: 'processing' })
        return next
      })

      const data = await res.json()
      if (data.success) {
        // 完了
        setTranscribing((prev) => {
          const next = new Map(prev)
          const info = next.get(materialId)
          if (info) next.set(materialId, { ...info, status: 'completed' })
          return next
        })
        await fetchProject()
        // 3秒後に表示を消す
        setTimeout(() => {
          setTranscribing((prev) => {
            const next = new Map(prev)
            next.delete(materialId)
            return next
          })
        }, 3000)
      } else {
        setTranscribing((prev) => {
          const next = new Map(prev)
          const info = next.get(materialId)
          if (info) next.set(materialId, { ...info, status: 'error', error: data.error })
          return next
        })
      }
    } catch {
      setTranscribing((prev) => {
        const next = new Map(prev)
        const info = next.get(materialId)
        if (info) next.set(materialId, { ...info, status: 'error', error: 'ネットワークエラー' })
        return next
      })
    }
  }

  // 素材削除
  const deleteMaterial = async (materialId: string) => {
    if (!confirm('この素材を削除しますか？')) return
    try {
      await fetch(`/api/interview/materials/${materialId}`, { method: 'DELETE' })
      await fetchProject()
    } catch {
      // ignore
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      {/* ヘッダー */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black tracking-tight mb-4">素材アップロード</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
          {projectTitle || 'インタビュー素材をアップロードして、AIが高精度の文字起こしと記事を自動生成します。'}
        </p>
        {materials.some((m) => m.status === 'COMPLETED') && (
          <button
            onClick={() => router.push(`/interview/projects/${projectId}/skill`)}
            className="mt-6 px-6 py-3 bg-[#7f19e6] text-white rounded-lg text-sm font-bold hover:bg-[#6b12c9] transition-all shadow-lg shadow-[#7f19e6]/20 inline-flex items-center gap-2"
          >
            スキル選択へ進む
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        )}
      </div>

      <motion.div
        className="bg-white shadow-2xl shadow-[#7f19e6]/5 rounded-2xl overflow-hidden border border-slate-100"
        variants={scaleInVariants}
        initial="hidden"
        animate="show"
      >
        <div className="p-8 md:p-12">
          {/* ドラッグ&ドロップゾーン */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed flex flex-col items-center justify-center py-16 px-6 transition-all group cursor-pointer rounded-xl ${
              dragOver
                ? 'border-[#7f19e6] bg-[#7f19e6]/10'
                : 'border-[#7f19e6]/20 bg-[#7f19e6]/5 hover:bg-[#7f19e6]/10'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4,.mov,.avi,.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
            />
            <div className="size-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[#7f19e6] text-4xl">cloud_upload</span>
            </div>
            <h3 className="text-xl font-bold mb-2">ファイルをドラッグ&ドロップ</h3>
            <p className="text-slate-500 text-sm mb-6">MP4, MOV, MP3, WAV, M4A, PDF, TXT, DOCX（最大5GB）</p>
            <span className="bg-[#7f19e6] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#7f19e6]/90 transition-all shadow-lg shadow-[#7f19e6]/20">
              ファイルを選択
            </span>
          </div>

          {/* Transcription Settings */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h5 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">文字起こし設定</h5>
            <div className="grid md:grid-cols-2 gap-6">
              <label className="flex items-center justify-between p-4 rounded-xl border-2 border-[#7f19e6] bg-[#7f19e6]/5 cursor-pointer">
                <div className="flex gap-4 items-center">
                  <div className="size-10 bg-[#7f19e6] text-white rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined">record_voice_over</span>
                  </div>
                  <div>
                    <p className="font-bold">話者分離</p>
                    <p className="text-xs text-slate-500">複数の話者を自動識別</p>
                  </div>
                </div>
                <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-[#7f19e6] rounded border-slate-300 focus:ring-[#7f19e6]" />
              </label>
              <label className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-[#7f19e6]/30 transition-all cursor-pointer">
                <div className="flex gap-4 items-center">
                  <div className="size-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <div>
                    <p className="font-bold">自動記事生成</p>
                    <p className="text-xs text-slate-500">文字起こし後に即座に記事生成</p>
                  </div>
                </div>
                <input type="checkbox" className="form-checkbox h-5 w-5 text-[#7f19e6] rounded border-slate-300 focus:ring-[#7f19e6]" />
              </label>
            </div>
          </div>
        </div>
      </motion.div>

      {/* フィーチャーハイライト */}
      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="space-y-2">
          <span className="material-symbols-outlined text-[#7f19e6]">speed</span>
          <h6 className="font-bold text-sm uppercase">高速アップロード</h6>
          <p className="text-sm text-slate-500">マルチスレッド転送でファイルを可能な限り高速に転送します。</p>
        </div>
        <div className="space-y-2">
          <span className="material-symbols-outlined text-[#7f19e6]">closed_caption</span>
          <h6 className="font-bold text-sm uppercase">高精度文字起こし</h6>
          <p className="text-sm text-slate-500">AssemblyAI搭載のAIモデルがプロ品質の文字起こしを実現します。</p>
        </div>
        <div className="space-y-2">
          <span className="material-symbols-outlined text-[#7f19e6]">security</span>
          <h6 className="font-bold text-sm uppercase">安全・セキュア</h6>
          <p className="text-sm text-slate-500">Supabase Storage経由の暗号化転送。音声データは安全に保管されます。</p>
        </div>
      </div>

      {/* セキュリティ・プライバシーポリシー */}
      <div className="mt-12 bg-slate-50 rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#7f19e6]/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[#7f19e6] text-xl">shield</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">セキュリティ・プライバシーについて</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">verified_user</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">暗号化転送・保管</h4>
                <p className="text-xs text-slate-500 leading-relaxed">すべてのファイルはSSL/TLS暗号化で転送され、Supabase Storage上でセキュアに保管されます。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">lock</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">アクセス制御</h4>
                <p className="text-xs text-slate-500 leading-relaxed">アップロードされたファイルはプロジェクトオーナーのみがアクセス可能です。第三者からのアクセスは遮断されています。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">timer_off</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">署名付きURL（有効期限付き）</h4>
                <p className="text-xs text-slate-500 leading-relaxed">ファイルへのアクセスURLは7日間の有効期限付き。期限切れ後は自動的にアクセス不可になります。</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">file_present</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">ファイル形式の検証</h4>
                <p className="text-xs text-slate-500 leading-relaxed">MIMEタイプとファイル拡張子の二重検証により、不正なファイルのアップロードを防止しています。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">transcribe</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">文字起こしデータの取扱い</h4>
                <p className="text-xs text-slate-500 leading-relaxed">文字起こし処理はAssemblyAI社のセキュアな環境で実行されます。処理後のデータはお客様のプロジェクト内にのみ保存されます。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg mt-0.5">delete_sweep</span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">データ削除</h4>
                <p className="text-xs text-slate-500 leading-relaxed">プロジェクトや素材は、いつでもお客様の操作で完全に削除できます。削除後は復元できません。</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-200">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ※ 本サービスでは、お客様がアップロードしたファイルをAI学習目的で使用することはありません。
            セキュリティに関するご質問やご懸念がございましたら、お気軽にお問い合わせください。
          </p>
        </div>
      </div>

      {/* アップロード進捗 */}
      <AnimatePresence>
      {uploads.size > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {Array.from(uploads.entries()).map(([key, upload]) => (
            <div key={key} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="material-symbols-outlined text-[#7f19e6] text-2xl">
                    {upload.status === 'done' ? 'check_circle' : upload.status === 'error' ? 'error' : 'upload_file'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {upload.file.name}
                    </p>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatFileSize(upload.file.size)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    upload.status === 'error'
                      ? 'bg-red-500'
                      : upload.status === 'done'
                      ? 'bg-green-500'
                      : 'bg-gradient-to-r from-[#7f19e6] to-blue-500'
                  }`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                {upload.status === 'uploading' && (
                  <>
                    <span className="material-symbols-outlined text-[#7f19e6] text-sm animate-spin">sync</span>
                    <p className="text-xs text-slate-600">アップロード中... {upload.progress}%</p>
                  </>
                )}
                {upload.status === 'confirming' && (
                  <>
                    <span className="material-symbols-outlined text-[#7f19e6] text-sm animate-pulse">pending</span>
                    <p className="text-xs text-slate-600">確認処理中...</p>
                  </>
                )}
                {upload.status === 'done' && (
                  <>
                    <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                    <p className="text-xs text-green-600 font-medium">アップロード完了</p>
                  </>
                )}
                {upload.status === 'error' && (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-600 text-sm">error</span>
                      <p className="text-xs text-red-600">{upload.error}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // 失敗エントリを削除して同じファイルで再アップロード
                        const file = upload.file
                        setUploads((prev) => {
                          const next = new Map(prev)
                          next.delete(key)
                          return next
                        })
                        uploadFile(file)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      再試行
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      )}
      </AnimatePresence>

      {/* 文字起こし進捗パネル */}
      <AnimatePresence>
      {transcribing.size > 0 && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {Array.from(transcribing.entries()).map(([id, info]) => {
            const isActive = info.status === 'starting' || info.status === 'processing'
            const currentStep = isActive ? getCurrentStep(info.startTime) : TRANSCRIPTION_STEPS.length - 1
            const elapsed = isActive ? formatElapsed(info.startTime) : ''

            return (
              <div
                key={id}
                className={`rounded-xl p-6 border-2 transition-all shadow-lg ${
                  info.status === 'completed'
                    ? 'bg-green-50 border-green-200 shadow-green-200/50'
                    : info.status === 'error'
                    ? 'bg-red-50 border-red-200 shadow-red-200/50'
                    : 'bg-blue-50 border-blue-200 shadow-blue-200/50'
                }`}
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      info.status === 'completed' ? 'bg-green-500' :
                      info.status === 'error' ? 'bg-red-500' : 'bg-[#7f19e6]'
                    }`}>
                      <span className="material-symbols-outlined text-white text-2xl">
                        {info.status === 'completed' ? 'check_circle' : info.status === 'error' ? 'error' : 'mic'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {info.status === 'completed'
                          ? '文字起こし完了!'
                          : info.status === 'error'
                          ? '文字起こしエラー'
                          : '文字起こし中...'}
                      </p>
                      <p className="text-xs text-slate-600">{info.fileName}</p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-[#7f19e6]">{elapsed}</p>
                      <p className="text-xs text-slate-500">経過時間</p>
                    </div>
                  )}
                </div>

                {/* エラー表示 */}
                {info.status === 'error' && info.error && (
                  <div className="flex items-center justify-between mb-3 bg-red-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-red-700">
                      <span className="material-symbols-outlined text-base">error</span>
                      <p>{info.error}</p>
                    </div>
                    <button
                      onClick={() => {
                        // 進捗パネルから削除して再実行
                        setTranscribing((prev) => {
                          const next = new Map(prev)
                          next.delete(id)
                          return next
                        })
                        startTranscription(id)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors shadow-sm shrink-0 ml-3"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      再試行
                    </button>
                  </div>
                )}

                {/* ステップインジケーター */}
                {info.status !== 'error' && (
                  <div className="flex items-center gap-2">
                    {TRANSCRIPTION_STEPS.map((step, i) => {
                      const isDone = info.status === 'completed' || i < currentStep
                      const isCurrent = isActive && i === currentStep
                      return (
                        <div key={i} className="flex items-center gap-2 flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div
                              className={`w-full h-2 rounded-full transition-all duration-500 ${
                                isDone
                                  ? 'bg-green-500'
                                  : isCurrent
                                  ? 'bg-[#7f19e6] animate-pulse'
                                  : 'bg-slate-200'
                              }`}
                            />
                            <div className="flex flex-col items-center gap-1 mt-2">
                              <span className={`material-symbols-outlined text-base ${
                                isDone ? 'text-green-600' : isCurrent ? 'text-[#7f19e6]' : 'text-slate-400'
                              }`}>
                                {step.icon}
                              </span>
                              <span
                                className={`text-[10px] ${
                                  isDone
                                    ? 'text-green-600 font-medium'
                                    : isCurrent
                                    ? 'text-[#7f19e6] font-bold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ファイルサイズに応じた推定時間 */}
                {isActive && info.fileSize && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-4 bg-white/60 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <p>
                      {info.fileSize > 25 * 1024 * 1024
                        ? '大容量ファイルのため、処理に数分かかる場合があります'
                        : '通常30秒〜2分程度で完了します'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      )}
      </AnimatePresence>

      {/* 素材一覧 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-slate-700 text-xl">folder</span>
          <h2 className="text-sm font-black text-slate-900">
            アップロード済み素材 ({materials.length})
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-slate-300 text-5xl mb-3">inventory_2</span>
            <p className="text-sm text-slate-500">まだ素材がアップロードされていません</p>
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {materials.map((m) => {
              const isTranscribing = transcribing.has(m.id)
              const transcriptionInfo = transcribing.get(m.id)

              return (
                <motion.div
                  key={m.id}
                  variants={itemVariants}
                  className={`bg-white rounded-xl p-5 border flex items-center gap-4 transition-all shadow-sm ${
                    isTranscribing && transcriptionInfo?.status !== 'completed'
                      ? 'border-blue-200 bg-blue-50/30 shadow-blue-100'
                      : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-[#7f19e6]/10 to-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#7f19e6] text-2xl">
                      {FILE_TYPE_ICONS[m.type] || 'attach_file'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate mb-1">{m.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">{formatFileSize(m.fileSize)}</span>
                      <span className="material-symbols-outlined text-xs">circle</span>
                      <span className="capitalize">{m.type}</span>
                      {m.status === 'ERROR' && (
                        <>
                          <span className="material-symbols-outlined text-xs">circle</span>
                          <span className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {m.error || 'エラーが発生しました'}
                          </span>
                        </>
                      )}
                      {m.transcriptionStatus === 'COMPLETED' && (
                        <>
                          <span className="material-symbols-outlined text-xs">circle</span>
                          <span className="text-[11px] text-green-600 font-medium flex items-center gap-1 border border-green-600/20 rounded-full px-2 py-0.5">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            文字起こし完了
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 text-xl" title={m.status}>
                    {STATUS_ICONS[m.status] || 'schedule'}
                  </span>
                  <div className="flex gap-2">
                    {/* 素材自体がERRORの場合の再アップロードボタン */}
                    {m.status === 'ERROR' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                      >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        再アップロード
                      </button>
                    )}
                    {(m.type === 'audio' || m.type === 'video') &&
                      (m.status === 'COMPLETED' || m.status === 'ERROR') &&
                      m.transcriptionStatus !== 'COMPLETED' &&
                      m.transcriptionStatus !== 'PROCESSING' &&
                      !isTranscribing && (
                        <button
                          onClick={() => startTranscription(m.id)}
                          className={`px-4 py-2 text-xs font-medium text-white rounded-lg transition-all flex items-center gap-1.5 ${
                            m.transcriptionStatus === 'ERROR'
                              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                              : 'bg-[#7f19e6] hover:bg-[#6b12c9] shadow-lg shadow-[#7f19e6]/20'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">
                            {m.transcriptionStatus === 'ERROR' ? 'refresh' : 'transcribe'}
                          </span>
                          {m.transcriptionStatus === 'ERROR' ? '再試行' : '文字起こし'}
                        </button>
                      )}
                    {(isTranscribing && transcriptionInfo?.status !== 'completed') && (
                      <span className="px-4 py-2 text-[11px] bg-blue-100 text-[#7f19e6] font-medium rounded-lg flex items-center gap-1.5 border border-[#7f19e6]/20">
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                        処理中
                      </span>
                    )}
                    {!isTranscribing && m.transcriptionStatus === 'PROCESSING' && (
                      <span className="px-4 py-2 text-[11px] bg-blue-100 text-[#7f19e6] font-medium rounded-lg flex items-center gap-1.5 border border-[#7f19e6]/20">
                        <span className="material-symbols-outlined text-base animate-spin">sync</span>
                        処理中
                      </span>
                    )}
                    <button
                      onClick={() => deleteMaterial(m.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      {/* アップロード中モーダル */}
      <AnimatePresence>
        {Array.from(uploads.values()).some((u) => u.status === 'uploading' || u.status === 'confirming') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header with animation */}
              <div className="p-6 pb-0 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-[#7f19e6]/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#7f19e6] text-4xl animate-bounce">cloud_upload</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">アップロード中...</h3>
                <p className="text-sm text-slate-500">ファイルをアップロードしています。このページを離れないでください。</p>
              </div>

              {/* Progress section */}
              <div className="p-6 space-y-4">
                {Array.from(uploads.entries())
                  .filter(([, u]) => u.status === 'uploading' || u.status === 'confirming')
                  .map(([key, upload]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700 truncate flex-1 mr-2">{upload.file.name}</span>
                        <span className="text-[#7f19e6] font-bold tabular-nums">{upload.progress}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#7f19e6] to-[#a855f7]"
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        {upload.status === 'confirming' ? '確認処理中...' : `${formatFileSize(upload.file.size)} をアップロード中`}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Tips section */}
              <div className="mx-6 mb-6 p-4 bg-[#7f19e6]/5 rounded-xl border border-[#7f19e6]/10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tipIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3"
                  >
                    <span className="material-symbols-outlined text-[#7f19e6] text-lg mt-0.5 flex-shrink-0">{UPLOAD_TIPS[tipIndex].icon}</span>
                    <div>
                      <p className="text-[10px] font-bold text-[#7f19e6]/60 uppercase tracking-wider mb-0.5">豆知識</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{UPLOAD_TIPS[tipIndex].text}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}