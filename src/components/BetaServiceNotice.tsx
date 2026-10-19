// ============================================
// ベータで非表示のサービスを、直接開いた人への案内
// ============================================
// src/lib/beta-services.ts で使えないと判定した人に、画面の代わりに出す。データには触れない。
import Link from 'next/link'

export default function BetaServiceNotice({ name }: { name: string }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="rounded-full bg-[#e8f0ff] px-3 py-1 text-xs font-bold text-[#0047d6]">開発中のベータ版</p>
      <h1 className="text-2xl font-extrabold text-[#101633]">{name}は、開発中のベータ版です</h1>
      <p className="text-sm leading-7 text-[#4a5375]">今は、限られた方だけがお使いいただけます。公開の準備ができしだい、ご案内します。</p>
      <Link href="/" className="mt-2 rounded-full bg-[#0066ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#0047d6]">ドヤAIのトップへ</Link>
    </main>
  )
}
