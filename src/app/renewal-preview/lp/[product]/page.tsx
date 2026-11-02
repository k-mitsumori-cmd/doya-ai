import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import { UNIFIED_PRO_PRICE_LABEL } from "@/lib/unified-plan";
import { DAILY_RECOVERY_AMOUNT, DAILY_RECOVERY_CAP } from "@/lib/doya-power/rules";
import { ProductLp, type Theme } from "../ProductLp";
import { PRODUCTS, PRODUCT_ORDER, isProductId } from "../products";
import "../renewal-lp-v3.css";
import "../renewal-lp-products.css";

// 5製品の LP の見本（2026-11-02）。/renewal-preview/lp/sales のように開く。?theme=dark で暗い配色に替わる。
// 土台はトップ LP の v3。検索に出さない・ログイン不要。本番のページ（src/app）は変えない。
// 料金は、司令塔の指示どおり「プロ1つ（月9,980円）で5つの製品が全部使える」と「無料で始められる」を全ページに書く。
const body = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500"], variable: "--u-body", display: "swap", preload: false });
const display = Zen_Maru_Gothic({ subsets: ["latin"], weight: ["500"], variable: "--u-display", display: "swap", preload: false });

export const dynamicParams = false;
export function generateStaticParams() {
  return PRODUCT_ORDER.map((product) => ({ product }));
}

type Props = { params: Promise<{ product: string }>; searchParams?: Promise<{ theme?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product } = await params;
  const p = isProductId(product) ? PRODUCTS[product] : null;
  return {
    title: p ? `ドヤバディ ${p.name} のLP見本` : "LP見本",
    robots: { index: false, follow: false },
  };
}

export default async function ProductLpPreview({ params, searchParams }: Props) {
  const { product } = await params;
  if (!isProductId(product)) notFound();
  const sp = (await searchParams) ?? {};
  const theme: Theme = sp.theme === "dark" ? "dark" : "light";
  return (
    <div className={`${body.variable} ${display.variable}`}>
      <ProductLp product={PRODUCTS[product]} theme={theme} plan={{ proPrice: UNIFIED_PRO_PRICE_LABEL, freeStart: DAILY_RECOVERY_CAP, freeDaily: DAILY_RECOVERY_AMOUNT }} />
    </div>
  );
}
