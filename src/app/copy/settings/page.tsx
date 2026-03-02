'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Settings, Plus, Trash2, Save } from 'lucide-react'

interface BrandVoice {
  id: string
  name: string
  tone: string
  vocabulary: string
  examples: string
  ngWords: string[]
  requiredWords: string[]
}

export default function CopySettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    tone: 'professional',
    vocabulary: '',
    examples: '',
    ngWordsInput: '',
    requiredWordsInput: '',
  })

  const isLoggedIn = !!session?.user

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/api/auth/signin?callbackUrl=/copy/settings')
    } else {
      fetchBrandVoices()
    }
  }, [isLoggedIn])

  const fetchBrandVoices = async () => {
    try {
      const res = await fetch('/api/copy/brand-voice')
      if (res.ok) {
        const data = await res.json()
        setBrandVoices(data.brandVoices || [])
      }
    } catch {
      // ignore
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return

    setSaving(true)
    try {
      const res = await fetch('/api/copy/brand-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          tone: form.tone,
          vocabulary: form.vocabulary,
          examples: form.examples,
          ngWords: form.ngWordsInput.split('\n').map(w => w.trim()).filter(Boolean),
          requiredWords: form.requiredWordsInput.split('\n').map(w => w.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        setForm({ name: '', tone: 'professional', vocabulary: '', examples: '', ngWordsInput: '', requiredWordsInput: '' })
        await fetchBrandVoices()
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このブランドボイスを削除しますか？')) return
    try {
      const res = await fetch(`/api/copy/brand-voice?id=${id}`, { method: 'DELETE' })
      if (res.ok) await fetchBrandVoices()
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-600" />
            ブランド設定
          </h1>
          <p className="text-gray-500 text-sm mt-1">ブランドボイスとNGワードを設定します</p>
        </div>

        {/* 新規作成フォーム */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-600" />
            新しいブランドボイスを追加
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">名前 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="例: 商品Aブランドボイス"
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">トーン</label>
              <select
                value={form.tone}
                onChange={(e) => setForm(p => ({ ...p, tone: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-amber-500"
              >
                <option value="professional">プロフェッショナル</option>
                <option value="casual">カジュアル</option>
                <option value="luxury">高級感</option>
                <option value="playful">ポップ</option>
                <option value="trustworthy">信頼感</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">ブランドボイス（語彙・表現スタイル）</label>
              <textarea
                value={form.vocabulary}
                onChange={(e) => setForm(p => ({ ...p, vocabulary: e.target.value }))}
                placeholder="例: 「〜する」ではなく「〜できる」を使う。前向きで行動を促すトーン。"
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">NGワード（1行1語）</label>
                <textarea
                  value={form.ngWordsInput}
                  onChange={(e) => setForm(p => ({ ...p, ngWordsInput: e.target.value }))}
                  placeholder={'最安値\n業界No.1\n奇跡'}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">必須ワード（1行1語）</label>
                <textarea
                  value={form.requiredWordsInput}
                  onChange={(e) => setForm(p => ({ ...p, requiredWordsInput: e.target.value }))}
                  placeholder={'ブランド名\n無料\n限定'}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving || !form.name}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存する'}
            </button>
          </form>
        </div>

        {/* ブランドボイス一覧 */}
        {brandVoices.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">登録済みブランドボイス</h2>
            <div className="space-y-3">
              {brandVoices.map((bv) => (
                <div
                  key={bv.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm"
                >
                  <div>
                    <p className="font-bold text-gray-900">{bv.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      トーン: {bv.tone}
                      {bv.ngWords.length > 0 && ` · NGワード: ${bv.ngWords.length}件`}
                      {bv.requiredWords.length > 0 && ` · 必須ワード: ${bv.requiredWords.length}件`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(bv.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
