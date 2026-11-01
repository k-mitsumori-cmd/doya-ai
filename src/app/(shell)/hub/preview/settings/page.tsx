// 開発用プレビュー: 使う製品と担当（/home/products）の画面を表示する（ログイン・DB不要）
// ⚠️ 本番では 404。画面確認・デザイン調整のためだけに使う。人と値は見本（保存は API が無いので失敗の表示になる）
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import ProductSettings from '@/components/products/ProductSettings'

export const dynamic = 'force-dynamic'

export default function ProductSettingsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <AppShell userName="サンプル" products={{ enabled: true, start: 'management', selfDefault: null, order: { main: ['management', 'sales', 'marketing', 'budget'], others: ['hr'] }, canManage: true }}>
      <p style={{ margin: 0, padding: '8px 16px', background: '#fff7d6', color: '#7a5b00', fontSize: 13, fontWeight: 700 }}>開発用の見本です。人と値は見本で、実際のデータではありません。</p>
      <ProductSettings
        initial={{
          enabled: ['management', 'sales', 'marketing', 'budget'],
          members: [
            { memberId: 'owner', email: 'owner@example.com', name: '見本 太郎', role: 'owner', isSelf: true, products: [], defaultProduct: null },
            { memberId: 'm1', email: 'sales@example.com', name: '見本 花子', role: 'member', isSelf: false, products: ['sales'], defaultProduct: 'sales' },
            { memberId: 'm2', email: 'keiri@example.com', name: null, role: 'billing', isSelf: false, products: ['budget', 'management'], defaultProduct: 'budget' },
          ],
        }}
      />
    </AppShell>
  )
}
