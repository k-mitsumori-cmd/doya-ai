// ドヤAI質問リンク LP用の画面モック（画像が揃うまでの表示。実データは使わない）
// バナーだけは Codex 内蔵の画像生成で作ったサンプル（public/asklink/sample-*.webp）を見せる
import Image from 'next/image'
import { Copy, Check, ExternalLink } from 'lucide-react'

export function AskLinkResultMock() {
  return (
    <div className="space-y-3 p-4 text-left">
      {[
        { label: 'サービスで何ができる？', len: 2911 },
        { label: '無料相談の準備をする', len: 3384 },
      ].map((l) => (
        <div key={l.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-black text-slate-800">{l.label}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
              <Check className="h-3 w-3" />
              合格
            </span>
          </div>
          <div className="mt-2 h-2 w-11/12 rounded bg-slate-100" />
          <div className="mt-1.5 h-2 w-8/12 rounded bg-slate-100" />
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <span>URL {l.len.toLocaleString()}文字</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#0066ff] px-2 py-1 text-white">
              <Copy className="h-3 w-3" />
              URLをコピー
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1">
              <ExternalLink className="h-3 w-3" />
              試す
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AskLinkBannerMock() {
  return (
    <div className="grid grid-cols-2 items-start gap-3 p-4">
      <figure className="col-span-2">
        <Image src="/asklink/sample-landscape.webp" alt="横長のサンプルバナー" width={1200} height={672} className="h-auto w-full rounded-lg shadow-sm ring-1 ring-slate-200" />
        <figcaption className="mt-1 text-[10px] font-bold text-slate-500">横長（PC向け）</figcaption>
      </figure>
      <figure>
        <Image src="/asklink/sample-square.webp" alt="正方形のサンプルバナー" width={1088} height={1088} className="h-auto w-full rounded-lg shadow-sm ring-1 ring-slate-200" />
        <figcaption className="mt-1 text-[10px] font-bold text-slate-500">正方形（スライドイン向け）</figcaption>
      </figure>
      <figure>
        <Image src="/asklink/sample-portrait.webp" alt="縦長のサンプルバナー" width={1152} height={1536} className="h-auto w-full rounded-lg shadow-sm ring-1 ring-slate-200" />
        <figcaption className="mt-1 text-[10px] font-bold text-slate-500">縦長（スマホ向け）</figcaption>
      </figure>
    </div>
  )
}

