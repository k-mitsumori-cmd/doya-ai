import GmailConnectCard from '@/components/gmail/GmailConnectCard'

export const metadata = { title: 'Gmail と連携 | 設定' }

export default function GmailSettingsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-black text-slate-900">設定</h1>
      <GmailConnectCard />
    </main>
  )
}
