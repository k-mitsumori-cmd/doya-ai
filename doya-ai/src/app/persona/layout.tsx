import PersonaAppLayout from '@/components/PersonaAppLayout'

export const metadata = {
  title: 'ドヤペルソナAI - マーケティングペルソナ自動生成',
  description: 'URLからターゲットペルソナを自動生成。キャッチコピー、広告文、LP構成まで一括作成できるマーケティング支援ツール。',
}

export default function PersonaLayout({ children }: { children: React.ReactNode }) {
  return <PersonaAppLayout>{children}</PersonaAppLayout>
}

