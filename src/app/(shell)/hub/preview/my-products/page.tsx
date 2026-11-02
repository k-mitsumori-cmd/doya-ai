// 開発用プレビュー: 自分の担当（/home/my-products）の画面を表示する（ログイン・DB不要）
// ⚠️ 本番（VERCEL_ENV=production）では 404。Vercel のプレビューと手元では開ける。画面確認・デザイン調整のためだけに使う。値は見本（保存は API が無いので失敗の表示になる）
// ?locked=1 で「管理者が本人に変えさせない」にした人の見え方
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import MyProducts from '@/components/products/MyProducts'

export const dynamic = 'force-dynamic'

export default async function MyProductsPreviewPage({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const locked = (await searchParams).locked === '1'
  return (
    <AppShell userName="サンプル" products={{ enabled: true, start: 'sales', selfDefault: null, order: { main: ['sales', 'management', 'marketing', 'budget'], others: ['hr'] }, canManage: false, canEditSelf: !locked, locked }}>
      <p style={{ margin: 0, padding: '8px 16px', background: '#fff7d6', color: '#7a5b00', fontSize: 13, fontWeight: 700 }}>開発用の見本です。値は見本で、実際のデータではありません。</p>
      <MyProducts
        initial={{
          admin: { products: ['sales'], defaultProduct: 'sales' },
          self: locked ? null : { products: ['sales', 'marketing'], defaultProduct: 'sales' },
          locked,
          enabled: ['management', 'sales', 'marketing', 'budget'],
          all: false,
        }}
      />
    </AppShell>
  )
}
