// ============================================
// LP共通シェル（マーケLP用ヘッダー＋フッター）
// 各サービスLPで個別にベタ書きしていた <header>/<footer> を統一。
// ============================================
import React from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { RenewalFrame, ResourcePack, PriceSummary } from "./renewal/Renewal";
import Link from "next/link";
import { CtaBand } from "./sections";
import { MobileNavigation } from "./renewal/MobileNavigation";
import { SERVICES } from "@/lib/services";
import { Sym, accentVars } from "./primitives";

export interface LpShellProps {
  /** サービス名（例: ドヤ商談準備） */
  serviceName: string;
  /** ブランドマークのMaterial Symbolアイコン名（絵文字は使わない） */
  icon: string;
  /** ヘッダー右のCTA遷移先（ダッシュボード等） */
  ctaHref: string;
  /** ヘッダーCTAの文言 */
  ctaLabel?: string;
  /**
   * ヘッダー「ログイン」の遷移先。
   * 未指定なら ctaHref が /auth/signin?callbackUrl=... のときそれを流用する。
   * ⚠️ ここを素の '/auth/signin' にすると、signin 側の既定 callbackUrl('/seo') が効いて
   *    ログイン後に別サービス（ドヤ記事作成）へ飛ぶ。CTAが署名URLでないLPは明示すること。
   */
  loginHref?: string;
  /** サービス別アクセント色 */
  accent?: string;
  children: React.ReactNode;
}

/** ブランドマーク（Material Symbolタイル＋サービス名。絵文字禁止） */
export function BrandMark({
  serviceName,
  icon,
  size = "md",
}: {
  serviceName: string;
  icon: string;
  size?: "sm" | "md" | "lg";
}) {
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  const tile =
    size === "lg" ? "w-11 h-11" : size === "sm" ? "w-8 h-8" : "w-9 h-9";
  return (
    <span className={`inline-flex items-center gap-2.5 font-black ${text}`}>
      <span
        className={`grid place-items-center ${tile} rounded-xl text-white shadow-lg`}
        style={{
          background: "linear-gradient(135deg, #0066ff, var(--lp-accent))",
          boxShadow: "0 8px 20px rgba(0,102,255,0.25)",
        }}
      >
        <Sym name={icon} size={size === "lg" ? 24 : 18} />
      </span>
      <span className="text-slate-900 tracking-tight">{serviceName}</span>
    </span>
  );
}

export function LpShell({
  serviceName,
  icon,
  ctaHref,
  ctaLabel = "はじめる",
  accent,
  loginHref,
  children,
}: LpShellProps) {
  const signinHref =
    loginHref ||
    (ctaHref.startsWith("/auth/signin") && ctaHref.includes("callbackUrl=")
      ? ctaHref
      : ctaHref);
  const sections = React.Children.toArray(children);
  const closingIndex = sections.findIndex(
    (child) => React.isValidElement(child) && child.type === CtaBand,
  );
  const closing = closingIndex >= 0 ? sections.splice(closingIndex, 1) : null;
  const service = SERVICES.find((s) => s.name === serviceName);
  return (
    <RenewalFrame serviceName={serviceName}>
      <div style={accentVars(accent)}>
        <a className="doya-skip-link" href="#doya-main">
          本文へスキップ
        </a>
        <header className="doya-header">
          <div className="doya-header-inner">
            <Link
              href="/"
              className="doya-header-brand"
              aria-label="ドヤマーケAI トップ"
            >
              <Image
                src={
                  service
                    ? `/renewal/icons/${service.id}.webp`
                    : "/character/hello.png"
                }
                width={40}
                height={40}
                alt=""
                unoptimized
              />
              <span>{serviceName}</span>
            </Link>
            <nav className="doya-desktop-nav" aria-label="メインナビゲーション">
              <Link href="/#doya-services">サービス</Link>
              <a href="#doya-how">使い方</a>
              <a href="#doya-resources">資料</a>
              <Link href="/pricing">料金</Link>
              <Link href={signinHref}>ログイン</Link>
              <Link href={ctaHref} className="doya-button">
                {ctaLabel}
                <ArrowRight size={16} />
              </Link>
            </nav>
            <MobileNavigation loginHref={signinHref} />
          </div>
        </header>
        <main id="doya-main" tabIndex={-1}>
          {sections}
          <ResourcePack />
          <PriceSummary />
          {closing}
        </main>
        <footer className="doya-footer">
          <div className="doya-section-inner">
            <div className="doya-footer-top">
              <div>
                <Link href="/">
                  <h2>ドヤマーケAI</h2>
                </Link>
                <p>
                  つくる仕事も、チームの仕事も。
                  <br />
                  あなたの毎日に、頼れるAIパートナー。
                </p>
              </div>
              <nav aria-label="フッターナビゲーション">
                <Link href="/#doya-services">サービス一覧</Link>
                <Link href="/pricing">料金プラン</Link>
                <Link href="/terms">利用規約</Link>
                <Link href="/privacy">プライバシー</Link>
                <Link href="/tokushoho">特定商取引法</Link>
                <a href="/resources/doya-ai/overview.html">サービス紹介資料</a>
              </nav>
            </div>
            <p className="doya-copyright">
              運営：株式会社スリスタ © {new Date().getFullYear()} SURISUTA Inc.
            </p>
          </div>
        </footer>
      </div>
    </RenewalFrame>
  );
}
