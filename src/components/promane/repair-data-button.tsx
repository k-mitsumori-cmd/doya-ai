'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/promane/ui/button'
import { Wrench } from 'lucide-react'
import { toast } from 'sonner'

export function RepairDataButton({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function handleRepair() {
    if (!confirm(
      'データ修復を実行しますか？\n\n以下を一括修正します:\n' +
      '・経費の負額 → 0\n' +
      '・契約金額の負額 → 0\n' +
      '・時間記録の負額 → 0\n' +
      '・時給の負額 → 0\n' +
      '・タスク/プロジェクトの逆転日付 → 終了日クリア\n\n' +
      '※ この操作は取り消せません'
    )) return

    setRunning(true)
    try {
      const res = await fetch(`/api/promane/repair?workspaceSlug=${encodeURIComponent(workspaceSlug)}`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || '修復に失敗しました', { duration: 6000 })
        return
      }
      if (data.totalFixed === 0) {
        toast.success('修復対象のデータはありませんでした 🎉', { duration: 4000 })
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
          `🔧 ${data.totalFixed}件のデータを修復しました\n(${parts.join(' / ')})`,
          { duration: 7000 }
        )
      }
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || '通信エラーが発生しました', { duration: 6000 })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      onClick={handleRepair}
      disabled={running}
      variant="outline"
      className="rounded-full font-black text-amber-600 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
    >
      <Wrench className="h-4 w-4 mr-1.5" />
      {running ? '修復中...' : '🔧 不正データを修復'}
    </Button>
  )
}
