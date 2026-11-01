// 開発用プレビュー: ツール内ナビの移動先（サーバーコンポーネント）
import { EmptyState } from '@/components/ds'

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <EmptyState kind="preparing" title="見本のページです" description="ツール内ナビで移動できることを確かめるためのページです。" />
    </div>
  )
}
