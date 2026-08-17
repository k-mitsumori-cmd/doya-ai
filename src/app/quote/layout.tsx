// ⚠️ サービスを追加したら必ず共通ヘッダーを入れること。
//    無いと、そのサービスに入った利用者が他のツールへ移れず、
//    トップへ戻る導線も無くなる（新4サービスで実際にそうなっていた）。
//    ゲスト画面（応募者・見込み客が開く経路）では ServiceTopBar 側で
//    自動的に非表示になる。
import { ServiceTopBar } from '@/components/ServiceTopBar'

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceTopBar serviceId="quote" serviceName="ドヤ見積もりAI" />
      {children}
    </>
  )
}
