// ドヤAI質問リンク LP用の画面モック（画像が揃うまでの表示。実データは使わない）
// ⚠️ 画像（public/asklink/*.png）は Codex に依頼中。届いたら Lp.tsx の image に差し替える
import { MessageCircleQuestion, Copy, Check, ExternalLink } from 'lucide-react'

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
    <div className="p-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-blue-100 p-5 text-left">
        <p className="text-[10px] font-black text-slate-500">サービス名</p>
        <p className="mt-2 text-lg font-black leading-snug text-[#0a0f3c]">その疑問、AIに聞いてみよう。</p>
        <p className="mt-1 text-xs font-bold text-slate-600">使い方を、会話でチェック。</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['何を頼める？', 'どう活用する？', '何を解決できる？'].map((b) => (
            <span key={b} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#0066ff] shadow-sm">
              {b}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0f3c] px-5 py-2 text-xs font-black text-white">
            <MessageCircleQuestion className="h-3.5 w-3.5" />
            AIに聞く →
          </span>
          <span className="mt-1 text-[9px] font-bold text-slate-500">ChatGPTが開きます</span>
        </div>
      </div>
    </div>
  )
}

export function AskLinkCopyMock() {
  return (
    <div className="space-y-2 p-4 text-left">
      {['URLをコピー', '質問文をコピー', '画像をコピー', 'コードをコピー'].map((t, i) => (
        <div key={t} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-xs font-black text-slate-700">{t}</span>
          {i === 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600">
              <Check className="h-3 w-3" />
              コピーしました
            </span>
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
      ))}
    </div>
  )
}
