'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { personaBrowserStorage } from '@/lib/persona/browser-storage'
import { deletePersonaRecord, clearPersonaRecords, selectPersonaRecord, savedPersonaPath } from '@/lib/persona/history-records'
import { Trash2, ExternalLink, Clock, Target } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import PersonaServerHistory from '@/components/persona/PersonaServerHistory'
import { isPersonaDisplayData, hasValidPersonaImages } from '@/lib/persona/display-data'

interface HistoryItem {
  id?: string
  serverStored?: boolean
  sceneImages?: Record<string, string>
  data: {
    persona: {
      name: string
      occupation: string
      age: number
      gender: string
    }
  }
  url: string
  timestamp: number
  portrait?: string
}

export default function PersonaHistoryPage() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  if (status !== 'authenticated' || !userId) return <p role="status" className="p-6">{status === 'loading' ? 'ログイン状態を確認しています。' : '履歴を表示するにはログインしてください。'}</p>
  return <AccountHistory key={userId} userId={userId} />
}

function AccountHistory({ userId }: { userId: string }) {
  const accountStorage = useMemo(() => personaBrowserStorage(userId), [userId])
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])

  const refreshHistory = () => {
    try {
      const parsed = JSON.parse(accountStorage.getItem('doya_persona_history') || '[]')
      if (!Array.isArray(parsed)) throw new Error('Invalid history')
      const readable = parsed.filter(item => item && isPersonaDisplayData(item.data) && hasValidPersonaImages(item) && Number.isFinite(item.timestamp) && typeof item.url === 'string')
      setHistory(readable)
      setError(readable.length === parsed.length ? '' : `${parsed.length - readable.length}件の履歴は形式を読み込めませんでした。元の保存データは削除していません。`)
    } catch { setError('このブラウザの履歴を読み込めませんでした。') }
  }

  useEffect(() => {
    refreshHistory()
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === null || accountStorage.isKey(event.key, 'doya_persona_history'))) refreshHistory()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [accountStorage])

  const deleteItem = (index: number) => {
    try {
      deletePersonaRecord(accountStorage, history[index])
      setError('')
      refreshHistory()
    } catch { setError('履歴を削除できませんでした。ブラウザの保存設定をご確認ください。') }
  }

  const loadItem = (item: HistoryItem) => {
    if (item.serverStored === true) {
      if (savedPersonaPath(item)) return true
      setError('保存済み履歴の情報が無効です。上の保存済み履歴から開き直してください。')
      return false
    }
    try {
      selectPersonaRecord(accountStorage, item)
      return true
    } catch { setError('ペルソナを読み込む準備ができませんでした。履歴が削除されたか、ブラウザに保存できない可能性があります。一覧を再読み込みしてください。'); return false }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const clearAll = () => {
    if (confirm('このブラウザの履歴をすべて削除しますか？ アカウントの保存済み履歴は削除されません。')) {
      try {
        clearPersonaRecords(accountStorage)
        setHistory([])
        setError('')
      } catch { setError('履歴を削除できませんでした。ブラウザの保存設定をご確認ください。') }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="mb-6 text-2xl font-black text-white">生成履歴</h1>
        <PersonaServerHistory userId={userId} onLocalChange={refreshHistory} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <Clock className="w-7 h-7 text-purple-400" />
              このブラウザの履歴
            </h2>
            <p className="text-slate-400 text-sm mt-1">直近のコピーを最大20件保存しています。ここでコピーを削除しても、アカウントの保存済み履歴は削除されません。</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              コピーをすべて削除
            </button>
          )}
        </div>

        {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}
        <p className="mb-4 text-sm text-slate-400">以前の共通保存形式の履歴は、所有者を確認できないため表示されません。</p>
        {history.length === 0 && !error ? (
          <EmptyState
            tone="dark"
            kind="not-generated"
            title="このブラウザには履歴がありません"
            description="保存済みのペルソナは、上の「アカウントの保存済み履歴」から開けます。"
            action={
              <Link
                href="/persona"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0066ff] px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-[#0057db]"
              >
                ペルソナを生成する
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={index}
                className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Portrait */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 overflow-hidden flex-shrink-0">
                      {item.portrait ? (
                        <img src={item.portrait} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-slate-600">
                          <Target className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        {item.data?.persona?.name || '不明'}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 truncate">
                        {item.data?.persona?.age}歳 / {item.data?.persona?.gender} / {item.data?.persona?.occupation}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {item.url}
                      </p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-0 w-full sm:w-auto flex-shrink-0">
                    <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                    <div className="flex items-center gap-2 sm:mt-2 ml-auto sm:ml-0">
                      <Link
                        href={savedPersonaPath(item) || '/persona'}
                        onClick={(event) => { if (!loadItem(item)) event.preventDefault() }}
                        className="p-2 text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors"
                        title="読み込む"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => deleteItem(index)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="このブラウザのコピーを削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
