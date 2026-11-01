'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/promane/confirm-dialog'
import { userErrorMessage, PROMANE_NETWORK_ERROR } from '@/lib/promane/user-error'

export function RepairDataButton({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const { confirm, ConfirmDialog } = useConfirm()

  async function handleRepair() {
    const ok = await confirm({
      title: '不正なデータを修復しますか？',
      message:
        '次のデータをまとめて直します。\n' +
        '・経費・契約金額・時間記録・時給のマイナスの値を 0 にする\n' +
        '・開始日より前の終了日（タスク・プロジェクト）を空にする\n\n' +
        'この操作は元に戻せません。',
      tone: 'warning',
      confirmLabel: '修復する',
      icon: '/character/working.png',
    })
    if (!ok) return

    setRunning(true)
    try {
      const res = await fetch(`/api/promane/repair?workspaceSlug=${encodeURIComponent(workspaceSlug)}`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(userErrorMessage(data?.error, '修復できませんでした。少し待って、もう一度お試しください。'), { duration: 6000 })
        return
      }
      if (data.totalFixed === 0) {
        toast.success('修復が必要なデータはありませんでした。', { duration: 4000 })
      } else {
        const details = data.details
        const parts = []
        if (details.negativeExpenses) parts.push(`経費${details.negativeExpenses}件`)
        if (details.negativeContracts) parts.push(`契約金額${details.negativeContracts}件`)
        if (details.negativeTimeEntries) parts.push(`時間記録${details.negativeTimeEntries}件`)
        if (details.negativeRates) parts.push(`時給${details.negativeRates}件`)
        if (details.reverseTaskDates) parts.push(`タスク日付${details.reverseTaskDates}件`)
        if (details.reverseProjectDates) parts.push(`プロジェクト日付${details.reverseProjectDates}件`)
        toast.success(
          `${data.totalFixed}件のデータを修復しました\n(${parts.join(' / ')})`,
          { duration: 7000 }
        )
      }
      router.refresh()
    } catch {
      toast.error(PROMANE_NETWORK_ERROR, { duration: 6000 })
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleRepair}
        disabled={running}
        variant="outline"
        className="rounded-full font-black text-amber-600 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
      >
        <Wrench className="h-4 w-4 mr-1.5" />
        {running ? '修復中...' : '不正なデータを修復する'}
      </Button>
      <ConfirmDialog />
    </>
  )
}
