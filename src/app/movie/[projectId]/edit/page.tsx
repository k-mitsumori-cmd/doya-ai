'use client'
// ============================================
// ドヤムービーAI - Step4: 編集ページ（Kling AI対応）
// ============================================
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Loader2, Save, Clapperboard, List, Eye, Pencil, Sparkles, ImageIcon } from 'lucide-react'
import type { SceneData, BgmTrack, MovieProjectData } from '@/lib/movie/types'

const STEPS = ['商品情報', 'ペルソナ', '企画選択', '編集']

function ScenePanel({
  scene,
  isSelected,
  onSelect,
  index,
}: {
  scene: SceneData
  isSelected: boolean
  onSelect: () => void
  index: number
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected
          ? 'border-rose-500 bg-rose-500/15'
          : 'border-rose-900/30 bg-slate-900/40 hover:border-rose-700/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
          isSelected ? 'bg-rose-500 text-white' : 'bg-rose-900/40 text-rose-400'
        }`}>
          {index + 1}
        </div>
        <span className={`text-xs font-semibold ${isSelected ? 'text-rose-200' : 'text-slate-400'}`}>
          シーン {index + 1}
        </span>
        <span className={`ml-auto text-xs ${isSelected ? 'text-rose-300' : 'text-slate-500'}`}>
          {scene.duration}秒
        </span>
      </div>

      {/* プロンプトプレビュー */}
      <div className="w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center text-xs text-center bg-gradient-to-br from-rose-950/50 to-slate-900 p-2">
        {scene.videoPrompt ? (
          <p className="text-rose-200/70 text-[7px] leading-relaxed line-clamp-3">{scene.videoPrompt}</p>
        ) : scene.texts[0] ? (
          <p className="text-white text-[8px] font-bold px-1 truncate">{scene.texts[0].content}</p>
        ) : (
          <div className="text-rose-400/50">
            <Sparkles className="w-4 h-4 mx-auto mb-0.5" />
            <span className="text-[7px]">AI動画</span>
          </div>
        )}
      </div>
    </button>
  )
}

function SceneEditor({
  scene,
  onChange,
}: {
  scene: SceneData
  onChange: (s: Partial<SceneData>) => void
}) {
  return (
    <div className="space-y-4">
      {/* AI動画生成プロンプト */}
      <div>
        <label className="flex items-center gap-1.5 text-rose-200 text-xs font-semibold mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          AI動画プロンプト（英語推奨）
        </label>
        <textarea
          value={scene.videoPrompt || ''}
          onChange={e => onChange({ videoPrompt: e.target.value })}
          rows={4}
          placeholder="例: Professional product showcase, modern office setting, sleek UI on laptop screen, cinematic lighting, 4K quality, advertising commercial style"
          className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors resize-none"
        />
        <p className="text-rose-400 text-xs mt-1">Kling AIが動画を生成する際の映像指示です</p>
      </div>

      {/* 参照画像URL */}
      <div>
        <label className="flex items-center gap-1.5 text-rose-200 text-xs font-semibold mb-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
          参照画像URL（任意）
        </label>
        <input
          type="url"
          value={scene.referenceImageUrl || ''}
          onChange={e => onChange({ referenceImageUrl: e.target.value })}
          placeholder="https://... （画像から動画を生成する場合）"
          className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
        />
        <p className="text-rose-400 text-xs mt-1">商品画像等を指定すると、画像ベースで動画を生成します</p>
      </div>

      {/* シーン尺 */}
      <div>
        <label className="block text-rose-200 text-xs font-semibold mb-1.5">シーン尺（秒）</label>
        <input
          type="number"
          value={scene.duration}
          onChange={e => onChange({ duration: Number(e.target.value) })}
          min={3}
          max={15}
          className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500/60"
        />
        <p className="text-rose-400 text-xs mt-1">Kling 3.0: 3〜15秒</p>
      </div>

      {/* テキスト（動画内に表示される想定テキスト） */}
      <div>
        <label className="text-rose-200 text-xs font-semibold mb-1.5 block">表示テキスト（参考用）</label>
        {scene.texts.map((text, ti) => (
          <div key={ti} className="rounded-xl border border-rose-900/30 bg-slate-800/40 p-3 mb-2">
            <input
              type="text"
              value={text.content}
              onChange={e => {
                const newTexts = [...scene.texts]
                newTexts[ti] = { ...text, content: e.target.value }
                onChange({ texts: newTexts })
              }}
              placeholder="表示テキスト..."
              className="w-full bg-slate-700/60 border border-rose-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500/60"
            />
          </div>
        ))}
      </div>

      {/* ナレーション */}
      <div>
        <label className="block text-rose-200 text-xs font-semibold mb-1.5">ナレーションテキスト（任意）</label>
        <textarea
          value={scene.narrationText || ''}
          onChange={e => onChange({ narrationText: e.target.value })}
          rows={2}
          placeholder="このシーンのナレーション..."
          className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 resize-none"
        />
      </div>
    </div>
  )
}

type MobileTab = 'scenes' | 'preview' | 'editor'

export default function EditPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<MovieProjectData | null>(null)
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [selectedScene, setSelectedScene] = useState(0)
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([])
  const [selectedBgm, setSelectedBgm] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')
  const isNewProject = !project?.outputUrl

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, bgmRes] = await Promise.all([
          fetch(`/api/movie/projects/${projectId}`),
          fetch('/api/movie/bgm'),
        ])
        if (!projRes.ok) throw new Error()
        const projData = await projRes.json()
        setProject(projData.project)
        // DB scenes have Json type for texts - cast to SceneData
        const rawScenes = projData.project.scenes || []
        setScenes(rawScenes.map((s: any) => ({
          ...s,
          texts: Array.isArray(s.texts) ? s.texts : [],
          videoPrompt: s.videoPrompt || s.metadata?.videoPrompt || '',
          referenceImageUrl: s.referenceImageUrl || s.metadata?.referenceImageUrl || '',
        })) as SceneData[])

        if (bgmRes.ok) {
          const bgmData = await bgmRes.json()
          setBgmTracks(bgmData.tracks || [])
        }
      } catch {
        toast.error('プロジェクトの読み込みに失敗しました')
        router.push('/movie')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId, router])

  const updateScene = (index: number, changes: Partial<SceneData>) => {
    setScenes(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...changes }
      return next
    })
  }

  const saveProject = async () => {
    setSaving(true)
    try {
      // シーンにvideoPromptとreferenceImageUrlをmetadataに含める
      const scenesWithMeta = scenes.map(s => ({
        ...s,
        metadata: {
          ...(s.metadata || {}),
          videoPrompt: s.videoPrompt || '',
          referenceImageUrl: s.referenceImageUrl || '',
        },
      }))

      // プレビュー保存
      await fetch('/api/movie/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scenes: scenesWithMeta }),
      })

      await fetch(`/api/movie/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: scenesWithMeta, status: 'editing' }),
      })

      toast.success('保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const startRender = async () => {
    setRendering(true)
    try {
      // まず保存
      const scenesWithMeta = scenes.map(s => ({
        ...s,
        metadata: {
          ...(s.metadata || {}),
          videoPrompt: s.videoPrompt || '',
          referenceImageUrl: s.referenceImageUrl || '',
        },
      }))

      await fetch(`/api/movie/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: scenesWithMeta, status: 'editing' }),
      })

      const res = await fetch('/api/movie/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format: 'mp4', bgmUrl: selectedBgm }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'レンダリングに失敗しました')
      }
      toast.success('AI動画生成を開始しました')
      router.push(`/movie/${projectId}`)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setRendering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    )
  }

  const currentScene = scenes[selectedScene]

  return (
    <div className="h-full flex flex-col">
      {/* トップバー */}
      <div className="flex-shrink-0 border-b border-rose-900/30 bg-slate-950/80 px-4 py-2 flex items-center gap-3">
        {isNewProject && (
          <div className="flex items-center gap-2 mr-2">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 3 ? 'bg-rose-500 text-white' :
                  i < 3 ? 'bg-rose-800 text-rose-300' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {i < 3 ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={`w-8 h-px ${i < 3 ? 'bg-rose-700/50' : 'bg-slate-700'}`} />}
              </div>
            ))}
          </div>
        )}
        <span className="text-white font-semibold text-sm truncate flex-1">{project?.name}</span>
        <button
          onClick={saveProject}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-rose-300 border border-rose-900/40 hover:bg-rose-900/20 transition-all flex items-center gap-1 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </button>
        <button
          onClick={startRender}
          disabled={rendering || loading}
          className="px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-1 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          {rendering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          AI動画生成
        </button>
      </div>

      {/* モバイルタブ切り替え */}
      <div className="md:hidden flex-shrink-0 border-b border-rose-900/30 bg-slate-950/80 flex">
        {([
          { key: 'scenes' as MobileTab, label: 'シーン', Icon: List },
          { key: 'preview' as MobileTab, label: 'プレビュー', Icon: Eye },
          { key: 'editor' as MobileTab, label: '編集', Icon: Pencil },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
              mobileTab === tab.key
                ? 'text-rose-300 border-b-2 border-rose-500 bg-rose-500/10'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.Icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* シーンリスト（左） */}
        <div className={`${mobileTab === 'scenes' ? 'flex' : 'hidden'} md:flex w-full md:w-48 flex-shrink-0 md:border-r border-rose-900/30 bg-slate-950/60 overflow-y-auto p-2 space-y-2 flex-col`}>
          <div className="text-rose-400 text-xs font-bold px-1 py-0.5">シーン</div>
          {scenes.map((scene, i) => (
            <ScenePanel
              key={scene.id || i}
              scene={scene}
              index={i}
              isSelected={selectedScene === i}
              onSelect={() => {
                setSelectedScene(i)
                setMobileTab('preview')
              }}
            />
          ))}
        </div>

        {/* プレビュー（中央） */}
        <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 items-center justify-center bg-slate-950 p-4 overflow-hidden`}>
          {currentScene ? (
            <div className="max-h-full max-w-full w-full max-w-lg">
              {/* AI動画プロンプトプレビュー */}
              <div
                className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 relative"
                style={{
                  aspectRatio: project?.aspectRatio === '16:9' ? '16/9' :
                               project?.aspectRatio === '9:16' ? '9/16' :
                               project?.aspectRatio === '1:1' ? '1/1' : '4/5',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-rose-950/80 to-slate-900 flex flex-col items-center justify-center p-6">
                  <Sparkles className="w-8 h-8 text-rose-400 mb-3 opacity-50" />
                  {currentScene.videoPrompt ? (
                    <p className="text-rose-200/80 text-xs text-center leading-relaxed max-w-xs">
                      {currentScene.videoPrompt}
                    </p>
                  ) : (
                    <p className="text-rose-400 text-xs text-center">
                      AI動画プロンプトを入力してください
                    </p>
                  )}
                  {currentScene.referenceImageUrl && (
                    <div className="mt-3 flex items-center gap-1.5 text-rose-300/60 text-xs">
                      <ImageIcon className="w-3.5 h-3.5" />
                      参照画像あり
                    </div>
                  )}
                </div>

                {/* テキストオーバーレイプレビュー */}
                {currentScene.texts.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                    {currentScene.texts.map((t, ti) => (
                      <p key={ti} className="text-white text-center font-bold text-sm">
                        {t.content}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* シーン情報 */}
              <div className="mt-3 flex items-center justify-between text-xs text-rose-400">
                <span>シーン {selectedScene + 1} / {scenes.length}</span>
                <span>{currentScene.duration}秒</span>
              </div>
            </div>
          ) : (
            <div className="text-rose-400 text-sm">シーンを選択してください</div>
          )}
        </div>

        {/* 編集パネル（右） */}
        <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-shrink-0 md:border-l border-rose-900/30 bg-slate-950/60 overflow-y-auto flex-col`}>
          <div className="p-3 border-b border-rose-900/30">
            <div className="text-white text-sm font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-400" />
              {currentScene ? `シーン ${selectedScene + 1} 編集` : 'シーンを選択'}
            </div>
            <p className="text-rose-400 text-xs mt-0.5">Kling 3.0 AIで動画を生成します</p>
          </div>
          {currentScene && (
            <div className="p-3">
              <SceneEditor
                scene={currentScene}
                onChange={(changes) => updateScene(selectedScene, changes)}
              />
            </div>
          )}

          {/* BGM選択 */}
          <div className="p-3 border-t border-rose-900/30">
            <div className="text-rose-200 text-xs font-semibold mb-2">BGM</div>
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedBgm(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                  !selectedBgm
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                    : 'text-slate-400 hover:bg-rose-900/20 border border-transparent'
                }`}
              >
                なし
              </button>
              {bgmTracks.slice(0, 6).map(track => (
                <button
                  key={track.id}
                  onClick={() => setSelectedBgm(track.url)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    selectedBgm === track.url
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                      : 'text-slate-400 hover:bg-rose-900/20 border border-transparent'
                  }`}
                >
                  <div className="font-semibold">{track.name}</div>
                  <div className="text-rose-400">{track.genre}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
