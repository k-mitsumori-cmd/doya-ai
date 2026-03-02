'use client'
// ============================================
// ドヤムービーAI - Step4: 編集ページ
// ============================================
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { SceneData, BgmTrack, MovieProjectData } from '@/lib/movie/types'

const STEPS = ['商品情報', 'ペルソナ', '企画選択', '編集']

const BGM_GENRES = [
  { id: 'corporate', label: 'コーポレート' },
  { id: 'energetic', label: 'エネルギッシュ' },
  { id: 'emotional', label: '感動的' },
  { id: 'minimal', label: 'ミニマル' },
  { id: 'fun', label: '楽しい' },
  { id: 'luxury', label: 'ラグジュアリー' },
]

const TRANSITIONS = ['fade', 'slide', 'wipe', 'zoom', 'none'] as const
const BG_ANIMATIONS = ['ken-burns', 'zoom-in', 'none'] as const
const TEXT_ANIMATIONS = ['fade-in', 'slide-up', 'typewriter', 'zoom-in', 'none'] as const

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
        <span className={`ml-auto text-xs ${isSelected ? 'text-rose-300/70' : 'text-slate-500'}`}>
          {scene.duration}秒
        </span>
      </div>

      {/* プレビューミニ */}
      <div className="w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center text-xs text-center"
        style={{
          background: scene.bgType === 'gradient' ? scene.bgValue || 'linear-gradient(135deg, #1e293b, #0f172a)' :
                      scene.bgType === 'color' ? (scene.bgValue || '#1e293b') :
                      'linear-gradient(135deg, #1e293b, #0f172a)',
        }}
      >
        {scene.texts[0] && (
          <p className="text-white text-[8px] font-bold px-1 truncate">{scene.texts[0].content}</p>
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
      {/* 背景 */}
      <div>
        <label className="block text-rose-200 text-xs font-semibold mb-1.5">背景タイプ</label>
        <div className="flex gap-2">
          {(['color', 'gradient', 'image', 'video'] as const).map(t => (
            <button
              key={t}
              onClick={() => onChange({ bgType: t })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                scene.bgType === t
                  ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                  : 'border-rose-900/30 text-slate-400 hover:border-rose-700/50'
              }`}
            >
              {t === 'color' ? 'カラー' : t === 'gradient' ? 'グラデ' : t === 'image' ? '画像' : '動画'}
            </button>
          ))}
        </div>
      </div>

      {scene.bgType === 'color' && (
        <div>
          <label className="block text-rose-200 text-xs font-semibold mb-1.5">背景色</label>
          <input
            type="color"
            value={scene.bgValue || '#1e293b'}
            onChange={e => onChange({ bgValue: e.target.value })}
            className="w-full h-10 rounded-lg cursor-pointer border border-rose-900/30 bg-transparent"
          />
        </div>
      )}

      {(scene.bgType === 'image' || scene.bgType === 'video') && (
        <div>
          <label className="block text-rose-200 text-xs font-semibold mb-1.5">背景URL</label>
          <input
            type="url"
            value={scene.bgValue || ''}
            onChange={e => onChange({ bgValue: e.target.value })}
            placeholder="https://..."
            className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60"
          />
        </div>
      )}

      {/* 尺 */}
      <div>
        <label className="block text-rose-200 text-xs font-semibold mb-1.5">シーン尺（秒）</label>
        <input
          type="number"
          value={scene.duration}
          onChange={e => onChange({ duration: Number(e.target.value) })}
          min={1}
          max={30}
          className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500/60"
        />
      </div>

      {/* トランジション */}
      <div>
        <label className="block text-rose-200 text-xs font-semibold mb-1.5">トランジション</label>
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS.map(t => (
            <button
              key={t}
              onClick={() => onChange({ transition: t })}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                scene.transition === t
                  ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                  : 'border-rose-900/30 text-slate-400 hover:border-rose-700/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* テキスト */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-rose-200 text-xs font-semibold">テキスト</label>
        </div>
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
              className="w-full bg-slate-700/60 border border-rose-900/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500/60 mb-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-rose-300/50 text-xs mb-1">アニメーション</div>
                <select
                  value={text.animation}
                  onChange={e => {
                    const newTexts = [...scene.texts]
                    newTexts[ti] = { ...text, animation: e.target.value as any }
                    onChange({ texts: newTexts })
                  }}
                  className="w-full bg-slate-700/60 border border-rose-900/30 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                >
                  {TEXT_ANIMATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <div className="text-rose-300/50 text-xs mb-1">フォントサイズ</div>
                <input
                  type="number"
                  value={text.fontSize}
                  onChange={e => {
                    const newTexts = [...scene.texts]
                    newTexts[ti] = { ...text, fontSize: Number(e.target.value) }
                    onChange({ texts: newTexts })
                  }}
                  min={12}
                  max={120}
                  className="w-full bg-slate-700/60 border border-rose-900/30 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                />
              </div>
            </div>
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
      // プレビュー保存
      await fetch('/api/movie/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scenes }),
      })

      await fetch(`/api/movie/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, status: 'editing' }),
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
      await fetch(`/api/movie/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, status: 'editing' }),
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
      toast.success('レンダリングを開始しました')
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
        <span className="material-symbols-outlined text-rose-400 animate-spin text-3xl">progress_activity</span>
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
          {saving ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">save</span>}
          保存
        </button>
        <button
          onClick={startRender}
          disabled={rendering || loading}
          className="px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-1 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          {rendering ? (
            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-sm">movie_creation</span>
          )}
          レンダリング
        </button>
      </div>

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* シーンリスト（左）*/}
        <div className="w-48 flex-shrink-0 border-r border-rose-900/30 bg-slate-950/60 overflow-y-auto p-2 space-y-2">
          <div className="text-rose-300/60 text-xs font-bold px-1 py-0.5">シーン</div>
          {scenes.map((scene, i) => (
            <ScenePanel
              key={scene.id || i}
              scene={scene}
              index={i}
              isSelected={selectedScene === i}
              onSelect={() => setSelectedScene(i)}
            />
          ))}
        </div>

        {/* プレビュー（中央）*/}
        <div className="flex-1 flex items-center justify-center bg-slate-950 p-4 overflow-hidden">
          {currentScene ? (
            <div
              className="max-h-full max-w-full rounded-xl overflow-hidden shadow-2xl shadow-black/50 relative"
              style={{
                aspectRatio: project?.aspectRatio === '16:9' ? '16/9' :
                             project?.aspectRatio === '9:16' ? '9/16' :
                             project?.aspectRatio === '1:1' ? '1/1' : '4/5',
                height: 'min(100%, 400px)',
                background: currentScene.bgType === 'gradient' ? currentScene.bgValue || 'linear-gradient(135deg, #1e293b, #0f172a)' :
                            currentScene.bgType === 'color' ? (currentScene.bgValue || '#1e293b') :
                            'linear-gradient(135deg, #1e293b, #0f172a)',
              }}
            >
              {currentScene.bgType === 'image' && currentScene.bgValue && (
                <img src={currentScene.bgValue} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                {currentScene.texts.map((t, ti) => (
                  <p
                    key={ti}
                    className="text-center font-bold"
                    style={{
                      fontSize: `${Math.max(t.fontSize * 0.3, 10)}px`,
                      color: t.color || '#ffffff',
                      fontFamily: t.fontFamily || 'inherit',
                      textAlign: t.align || 'center',
                    }}
                  >
                    {t.content}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-rose-200/40 text-sm">シーンを選択してください</div>
          )}
        </div>

        {/* 編集パネル（右）*/}
        <div className="w-72 flex-shrink-0 border-l border-rose-900/30 bg-slate-950/60 overflow-y-auto">
          <div className="p-3 border-b border-rose-900/30">
            <div className="text-white text-sm font-bold">
              {currentScene ? `シーン ${selectedScene + 1} 編集` : 'シーンを選択'}
            </div>
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
                  <div className="text-rose-300/50">{track.genre}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
