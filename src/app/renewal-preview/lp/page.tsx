import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { getListedServiceCount } from "@/lib/services";
import { UNIFIED_PRO_PRICE_LABEL } from "@/lib/unified-plan";
import { RenewalLpV2 } from "./RenewalLpV2";
import "./renewal-lp-v2.css";

// トップ LP の全面リニューアルの見本（2026-10-27）。v2 はド派手版（参考: elayadesigns の作品集）。v1 は RenewalLp.tsx に残す。
// 検索に出さない・ログイン不要。本番のトップ（src/app/page.tsx）は変えない。
const inter = Inter({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--rlp-latin", display: "swap" });
const noto = Noto_Sans_JP({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--rlp-jp", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "トップLPリニューアル見本 | ドヤAI",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://doya-ai.surisuta.jp/" },
};

export default function RenewalLpPreview() {
  return (
    <div className={`${inter.variable} ${noto.variable}`}>
      <RenewalLpV2 toolCount={getListedServiceCount()} proPrice={UNIFIED_PRO_PRICE_LABEL} />
    </div>
  );
}
