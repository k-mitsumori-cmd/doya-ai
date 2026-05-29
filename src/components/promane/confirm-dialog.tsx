'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/promane/ui/button'
import { AlertTriangle, X } from 'lucide-react'
import Image from 'next/image'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning' | 'info'
  icon?: string // character image path
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (confirmed: boolean) => void
}

/**
 * window.confirm() の代替: 統一感のあるカスタムモーダル
 *
 * 使い方:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   const ok = await confirm({ message: '本当に削除しますか？', tone: 'danger' })
 *   if (ok) { ... }
 *
 * JSX 内に <ConfirmDialog /> を1つだけ配置
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ open: false, message: '' })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const handleClose = useCallback((confirmed: boolean) => {
    state.resolve?.(confirmed)
    setState((prev) => ({ ...prev, open: false }))
  }, [state])

  const ConfirmDialog = () => {
    if (!state.open) return null
    const tone = state.tone || 'danger'
    const toneStyles = {
      danger: {
        bg: 'from-rose-500 to-red-600',
        text: 'text-rose-700',
        iconBg: 'bg-rose-100',
        confirmBtn: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700',
      },
      warning: {
        bg: 'from-amber-500 to-orange-600',
        text: 'text-amber-700',
        iconBg: 'bg-amber-100',
        confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700',
      },
      info: {
        bg: 'from-blue-500 to-violet-600',
        text: 'text-blue-700',
        iconBg: 'bg-blue-100',
        confirmBtn: 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700',
      },
    }[tone]

    return (
      <div
        className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fade-in"
        onClick={() => handleClose(false)}
      >
        <div
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-bounce-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-2xl ${toneStyles.iconBg} flex items-center justify-center`}>
                {state.icon ? (
                  <Image src={state.icon} alt="" width={32} height={32} unoptimized />
                ) : (
                  <AlertTriangle className={`h-6 w-6 ${toneStyles.text}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {state.title && (
                  <h3 className="text-[17px] font-black text-gray-900 mb-1">{state.title}</h3>
                )}
                <p className="text-[14px] text-gray-700 font-bold leading-relaxed whitespace-pre-wrap">
                  {state.message}
                </p>
              </div>
              <button
                onClick={() => handleClose(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="rounded-full font-black"
            >
              {state.cancelLabel || 'キャンセル'}
            </Button>
            <Button
              onClick={() => handleClose(true)}
              className={`rounded-full font-black text-white shadow-md ${toneStyles.confirmBtn}`}
            >
              {state.confirmLabel || 'OK'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return { confirm, ConfirmDialog }
}
