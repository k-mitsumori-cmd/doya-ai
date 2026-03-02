'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

// ============================================
// Types
// ============================================
interface BrandVoice {
  id?: string
  name: string
  firstPerson: string
  formality: number
  energy: number
  expertise: number
  humor: number
  targetAudience: string
  styleSample: string
  preferredExpressions: string[]
  bannedWords: string[]
  isDefault: boolean
}

interface BrandVoiceEditorProps {
  brandVoice?: BrandVoice
  onSave: (data: BrandVoice) => void
  onCancel: () => void
}

// ============================================
// スライダーラベル
// ============================================
const SLIDER_CONFIG = [
  {
    key: 'formality' as const,
    label: 'フォーマル度',
    icon: 'business_center',
    leftLabel: 'カジュアル',
    rightLabel: 'フォーマル',
  },
  {
    key: 'energy' as const,
    label: '熱量',
    icon: 'local_fire_department',
    leftLabel: '落ち着き',
    rightLabel: '情熱的',
  },
  {
    key: 'expertise' as const,
    label: '専門性',
    icon: 'school',
    leftLabel: '一般向け',
    rightLabel: '専門的',
  },
  {
    key: 'humor' as const,
    label: 'ユーモア',
    icon: 'sentiment_very_satisfied',
    leftLabel: '真面目',
    rightLabel: 'ユーモア',
  },
]

// ============================================
// BrandVoiceEditor コンポーネント
// ============================================
export default function BrandVoiceEditor({
  brandVoice,
  onSave,
  onCancel,
}: BrandVoiceEditorProps) {
  const isEditMode = !!brandVoice?.id

  // フォームステート
  const [name, setName] = useState(brandVoice?.name || '')
  const [firstPerson, setFirstPerson] = useState(brandVoice?.firstPerson || '私')
  const [formality, setFormality] = useState(brandVoice?.formality || 3)
  const [energy, setEnergy] = useState(brandVoice?.energy || 3)
  const [expertise, setExpertise] = useState(brandVoice?.expertise || 3)
  const [humor, setHumor] = useState(brandVoice?.humor || 3)
  const [targetAudience, setTargetAudience] = useState(brandVoice?.targetAudience || '')
  const [styleSample, setStyleSample] = useState(brandVoice?.styleSample || '')
  const [preferredExpressions, setPreferredExpressions] = useState<string[]>(
    brandVoice?.preferredExpressions || []
  )
  const [bannedWords, setBannedWords] = useState<string[]>(
    brandVoice?.bannedWords || []
  )
  const [isDefault, setIsDefault] = useState(brandVoice?.isDefault || false)

  // タグ入力用ステート
  const [preferredInput, setPreferredInput] = useState('')
  const [bannedInput, setBannedInput] = useState('')

  // スライダー値の取得
  const getSliderValue = (key: string): number => {
    switch (key) {
      case 'formality':
        return formality
      case 'energy':
        return energy
      case 'expertise':
        return expertise
      case 'humor':
        return humor
      default:
        return 3
    }
  }

  const setSliderValue = (key: string, value: number) => {
    switch (key) {
      case 'formality':
        setFormality(value)
        break
      case 'energy':
        setEnergy(value)
        break
      case 'expertise':
        setExpertise(value)
        break
      case 'humor':
        setHumor(value)
        break
    }
  }

  // ============================================
  // タグ追加/削除
  // ============================================
  const addPreferred = useCallback(() => {
    const trimmed = preferredInput.trim()
    if (trimmed && !preferredExpressions.includes(trimmed)) {
      setPreferredExpressions((prev) => [...prev, trimmed])
      setPreferredInput('')
    }
  }, [preferredInput, preferredExpressions])

  const removePreferred = useCallback((tag: string) => {
    setPreferredExpressions((prev) => prev.filter((t) => t !== tag))
  }, [])

  const addBanned = useCallback(() => {
    const trimmed = bannedInput.trim()
    if (trimmed && !bannedWords.includes(trimmed)) {
      setBannedWords((prev) => [...prev, trimmed])
      setBannedInput('')
    }
  }, [bannedInput, bannedWords])

  const removeBanned = useCallback((tag: string) => {
    setBannedWords((prev) => prev.filter((t) => t !== tag))
  }, [])

  // ============================================
  // 保存
  // ============================================
  const handleSave = useCallback(() => {
    if (!name.trim()) return

    onSave({
      id: brandVoice?.id,
      name: name.trim(),
      firstPerson: firstPerson.trim() || '私',
      formality,
      energy,
      expertise,
      humor,
      targetAudience: targetAudience.trim(),
      styleSample: styleSample.trim(),
      preferredExpressions,
      bannedWords,
      isDefault,
    })
  }, [
    name, firstPerson, formality, energy, expertise, humor,
    targetAudience, styleSample, preferredExpressions, bannedWords,
    isDefault, brandVoice?.id, onSave,
  ])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      {/* ヘッダー */}
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          {isEditMode ? 'ブランドボイスを編集' : '新しいブランドボイス'}
        </h2>
        <p className="text-slate-500">
          AIが生成するコンテンツのトーンや文体を設定します
        </p>
      </div>

      <div className="space-y-6">
        {/* ======== 名前 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            ブランドボイス名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 公式ブログ用、カジュアルSNS用"
            className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* ======== 一人称 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            一人称
          </label>
          <input
            type="text"
            value={firstPerson}
            onChange={(e) => setFirstPerson(e.target.value)}
            placeholder="例: 私、僕、我々、弊社"
            className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* ======== スライダー群 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">tune</span>
            トーン設定
          </h3>

          {SLIDER_CONFIG.map((slider) => {
            const value = getSliderValue(slider.key)
            return (
              <div key={slider.key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-slate-400">
                      {slider.icon}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{slider.label}</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{value}/5</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-16 text-right">{slider.leftLabel}</span>
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={value}
                      onChange={(e) => setSliderValue(slider.key, Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-blue-500 [&::-webkit-slider-thumb]:to-blue-700 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-gradient-to-r [&::-moz-range-thumb]:from-blue-500 [&::-moz-range-thumb]:to-blue-700 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
                    />
                    {/* ドット目盛り */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-full flex items-center justify-between px-0.5 pointer-events-none">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <div
                          key={dot}
                          className={`w-1.5 h-1.5 rounded-full ${
                            dot <= value ? 'bg-blue-300' : 'bg-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-16">{slider.rightLabel}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ======== ターゲット読者 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            ターゲット読者
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="例: 30-40代のビジネスパーソン、マーケティング担当者"
            className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* ======== 文体サンプル ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            文体サンプル
          </label>
          <textarea
            value={styleSample}
            onChange={(e) => setStyleSample(e.target.value)}
            placeholder="理想の文章の例を入力してください。AIがこのスタイルを参考にコンテンツを生成します..."
            rows={5}
            className="w-full px-4 py-3.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        {/* ======== 好みの表現 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            好みの表現
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={preferredInput}
              onChange={(e) => setPreferredInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addPreferred()
                }
              }}
              placeholder="表現を入力してEnter"
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            <button
              onClick={addPreferred}
              className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              追加
            </button>
          </div>
          {preferredExpressions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferredExpressions.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200"
                >
                  {tag}
                  <button
                    onClick={() => removePreferred(tag)}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-emerald-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ======== 禁止ワード ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-bold text-slate-900 mb-2">
            禁止ワード
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={bannedInput}
              onChange={(e) => setBannedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addBanned()
                }
              }}
              placeholder="禁止ワードを入力してEnter"
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            <button
              onClick={addBanned}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              追加
            </button>
          </div>
          {bannedWords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bannedWords.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200"
                >
                  {tag}
                  <button
                    onClick={() => removeBanned(tag)}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ======== デフォルト設定 ======== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">デフォルトに設定</h3>
              <p className="text-xs text-slate-400 mt-1">
                新規プロジェクトで自動的にこのブランドボイスを使用します
              </p>
            </div>
            <button
              onClick={() => setIsDefault(!isDefault)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                isDefault ? 'bg-blue-500' : 'bg-slate-300'
              }`}
            >
              <motion.div
                className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ left: isDefault ? '1.5rem' : '0.125rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* ======== 保存/キャンセルボタン ======== */}
        <div className="flex items-center justify-end gap-3 pt-4 pb-8">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className={`flex items-center gap-2 px-8 py-3 text-sm font-bold rounded-xl transition-all ${
              name.trim()
                ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {isEditMode ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
