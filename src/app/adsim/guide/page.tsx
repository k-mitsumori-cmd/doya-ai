export default function AdSimGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">ドヤ広告シミュレーションAI 使い方ガイド</h1>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold text-indigo-700">1. プロジェクト作成</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            「新規提案を作成」から5ステップのウィザードに入力します。
            クライアント情報 → 提案目的 → 予算・KPI → 媒体配分 → 体裁 の順番です。
          </p>
        </section>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold text-indigo-700">2. 自動生成される内容</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm text-gray-700">
            <li>媒体別 × 月次のシミュレーション数値（Imp / Click / CTR / CPC / CV / CPA / ROAS）</li>
            <li>提案テキスト10セクション（サマリ・戦略・媒体選定理由・KPI設計 他）</li>
            <li>グラフ5種（予算配分・CV推移・媒体別パフォーマンス・ファネル・業界比較）</li>
            <li>PDF / PPTX / Excel 出力（Phase 2）</li>
          </ul>
        </section>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold text-indigo-700">3. 数値の根拠と免責</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            シミュレーション数値は業界レポートを基にした平均ベンチマークと決定論的ロジックで算出しています。
            提案テキストはGeminiによる生成です。実際の広告運用結果を保証するものではないため、
            提案先にはあくまで「参考値」として提示してください。
          </p>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-3 text-xl font-bold text-amber-800">対応媒体（MVP）</h2>
          <p className="text-sm text-amber-900">
            現在は Google広告 / Meta広告 / LINE広告 の3媒体に対応しています。
            Phase 2 で X / TikTok / Yahoo! にも対応予定です。
          </p>
        </section>
      </div>
    </div>
  )
}
