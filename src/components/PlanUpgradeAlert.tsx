'use client'
import { Lock } from 'lucide-react'
import Link from 'next/link'

interface PlanUpgradeAlertProps {
  message: string
  upgradePath: string
  serviceName?: string
}

export default function PlanUpgradeAlert({ message, upgradePath, serviceName }: PlanUpgradeAlertProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">{message}</p>
        <Link href={upgradePath} className="text-sm text-amber-700 hover:text-amber-800 hover:underline mt-1 inline-block">
          プランをアップグレード →
        </Link>
      </div>
    </div>
  )
}
