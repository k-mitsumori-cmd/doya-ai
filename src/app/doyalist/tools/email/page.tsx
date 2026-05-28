'use client'
import ToolForm from '@/components/doyalist/ToolForm'

export default function EmailToolPage() {
  return (
    <ToolForm
      type="email"
      title="メール文面 作成"
      subtitle="新規開拓メール（件名+本文）をAIが作成"
      emoji="📧"
      charHero="/kintai/characters/present_プレゼン.png"
    />
  )
}
