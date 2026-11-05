'use client'

import PaymentThanks from '@/components/pricing/PaymentThanks'

interface UpgradeSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  /** 今は文面に使わない（どのプランでも同じ文面。呼ぶ側の確認スクリプトが見ている） */
  planName?: 'LIGHT' | 'PRO' | 'ENTERPRISE'
}

/** プランの反映のお礼。見せ方は追加購入・人数の追加と同じ PaymentThanks に揃える */
export default function UpgradeSuccessModal({ isOpen, onClose }: UpgradeSuccessModalProps) {
  return <PaymentThanks view={isOpen ? { kind: 'plan' } : null} onClose={onClose} />
}
