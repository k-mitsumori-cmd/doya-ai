'use client'

import React from 'react'

export class ClientErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  { hasError: boolean; error?: Error }
> {
  state: { hasError: boolean; error?: Error } = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    // 本番でも最低限はログに残す（Vercel log で追える）
    console.error('[ClientErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || '不明なエラー'
      return (
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-900">
            <p className="font-extrabold text-lg">{this.props.title || 'エラーが発生しました'}</p>
            <p className="text-sm mt-2">ページの表示中にエラーが発生しました。再読み込みしてください。</p>
            <pre className="text-xs whitespace-pre-wrap mt-4 p-3 rounded-xl bg-white/70 border border-red-100 text-red-900">
              {msg}
            </pre>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
                onClick={() => window.location.reload()}
              >
                再読み込み
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-gray-800 hover:bg-gray-50"
                onClick={() => this.setState({ hasError: false, error: undefined })}
              >
                この画面を閉じる
              </button>
            </div>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}




