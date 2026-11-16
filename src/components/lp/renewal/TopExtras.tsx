"use client";
// ============================================
// トップページの追加の部品（2026-11-10 メインのフィードバックによる）
// - CountUp: 数字を数え上げる（画面に入ったとき1回だけ。動きを減らす設定では最初から最終の値）
// - OutputGallery: 実際に出る物の例（今ある画像だけを使う。新しい画像は作らない）
// - LP_CARD_IO: ツールのカードの説明を「何を入れると、何が出るか」にそろえた文言
// ============================================
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(to * eased));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        setValue(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);
  // 読み上げは最終の値だけ（数えている途中の数字を読ませない）
  return (
    <span ref={ref} className="doya-count" aria-label={String(to)}>
      <span aria-hidden="true">{value}</span>
    </span>
  );
}

/**
 * カードの説明。「入れる物 → 出る物」の形にそろえる（services.ts の description から言い換えた。機能は足していない）。
 * ここに無いツールは services.ts の description をそのまま出す。
 */
export const LP_CARD_IO: Record<string, { input: string; output: string }> = {
  banner: { input: "商品と伝えたいこと", output: "バナーの案" },
  seo: { input: "狙うキーワード", output: "SEO・LLMO向けの長文記事" },
  interview: { input: "インタビューの音声", output: "読み物の記事" },
  persona: { input: "商品やサイトのURL", output: "届けたい相手の人物像" },
  hr: { input: "社員の情報", output: "人材の一覧と育成の記録" },
  kintai: { input: "出勤・退勤の打刻", output: "月ごとの勤怠の集計" },
  doyalist: { input: "探したい会社の条件", output: "営業リストと営業の文面" },
  promane: { input: "案件と作業の時間", output: "進み具合・収支・人件費の一覧" },
  doyaslide: { input: "伝えたい内容", output: "画像で作ったスライド一式" },
  sfa: { input: "取引先・商談・タスク", output: "ひとつにまとまった営業の管理表" },
  shodan: { input: "商談先のURL", output: "企業の調査（プロは提案資料も）" },
  aio: { input: "自社のブランド", output: "ChatGPT などのAIでの見え方の比較" },
  mensetsu: { input: "面接の質問", output: "AIの一次面接と評価のレポート" },
  quote: { input: "サービスのURL", output: "相場つきの見積もりとPDF" },
  aishodan: { input: "サービスのURL", output: "24時間受けられるAIの一次商談" },
  adimage: { input: "サイトのURL", output: "媒体ごとのサイズの広告画像" },
  asklink: { input: "サイトのURL", output: "「AIに聞く」リンクとバナー" },
  popup: { input: "サイトのURL", output: "ポップアップの案と表示用のタグ" },
};

// ドヤスライドで選べる表紙（public/doyaslide/template-covers/）。実際の画面で選べる見本の画像だけを使う
const SLIDE_COVERS = [
  { src: "/doyaslide/template-covers/01-minimal-isometric.webp", alt: "業務設計支援サービスのご提案の表紙" },
  { src: "/doyaslide/template-covers/14-data-dashboard.webp", alt: "経営ダッシュボードのご提案の表紙" },
  { src: "/doyaslide/template-covers/03-future-grid.webp", alt: "データ基盤統合サービスの構想提案の表紙" },
  { src: "/doyaslide/template-covers/09-editorial-red.webp", alt: "市場調査・インサイト分析のご提案の表紙" },
];

export function OutputGallery() {
  return (
    <section className="doya-output-gallery" aria-labelledby="doya-output-gallery-title">
      <div className="doya-section-inner">
        <span className="doya-eyebrow">WHAT YOU GET</span>
        <h2 id="doya-output-gallery-title">できあがるのは、こんな物。</h2>
        <p>
          ドヤスライドで選べる表紙のデザインです。内容を入れると、この見た目でスライドが一式できます。
        </p>
        <div className="doya-output-grid">
          {SLIDE_COVERS.map((c, i) => (
            <figure key={c.src} className="doya-output-item" style={{ ["--i" as string]: i }}>
              <Image src={c.src} alt={c.alt} width={640} height={360} unoptimized loading="lazy" />
            </figure>
          ))}
        </div>
        <Link href="/doyaslide" className="doya-text-link">
          ドヤスライドを見る <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
