'use client'

import React from 'react'

type ClientErrorBoundaryProps = {
  children: React.ReactNode
  title?: string
  description?: string
  /**
   * 追加のリセット処理（例: stateの再読み込み）
   */
  onReset?: () => void
}

type ClientErrorBoundaryState = {
  hasError: boolean
  message?: string
}

class Boundary extends React.Component<ClientErrorBoundaryProps, ClientErrorBoundaryState> {
  state: ClientErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(err: unknown): ClientErrorBoundaryState {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : '不明なエラー'
    return { hasError: true, message }
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ClientErrorBoundary]', err)
  }

  reset = () => {
    this.setState({ hasError: false, message: undefined })
    try {
      this.props.onReset?.()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ClientErrorBoundary] onReset failed', e)
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.title || '表示中にエラーが発生しました'
    const desc =
      this.props.description ||
      '一時的な問題の可能性があります。再読み込み（リセット）をお試しください。'

    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <p className="text-sm font-black text-red-700">{title}</p>
        <p className="mt-1 text-xs font-bold text-red-700/80">{desc}</p>
        {process.env.NODE_ENV !== 'production' && this.state.message ? (
          <pre className="mt-3 text-[10px] text-red-700/70 whitespace-pre-wrap break-words">
            {this.state.message}
          </pre>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="h-10 px-4 rounded-xl bg-red-700 text-white font-black text-xs hover:bg-red-800 transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }
}

export function ClientErrorBoundary(props: ClientErrorBoundaryProps) {
  return <Boundary {...props} />
}
