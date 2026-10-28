import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { getListedServiceCount } from "@/lib/services";
import { FREE_MAX_MEMBERS, TEAM_BASE_MONTHLY, TEAM_SEAT_TIERS, ENTERPRISE_MIN_SEATS, YEARLY_FREE_MONTHS, TEAM_MONTHLY_POINTS_BASE, TEAM_MONTHLY_POINTS_PER_SEAT, POWER_PACK } from "@/lib/pricing-v2/plans";
import { DAILY_RECOVERY_AMOUNT, DAILY_RECOVERY_CAP } from "@/lib/doya-power/rules";
import { RenewalLpV2 } from "./RenewalLpV2";
import "./renewal-lp-v2.css";

// トップ LP の全面リニューアルの見本（2026-10-27）。v2 はド派手版（参考: elayadesigns の作品集）。v1 は RenewalLp.tsx に残す。
// 検索に出さない・ログイン不要。本番のトップ（src/app/page.tsx）は変えない。
// 料金は新しい料金（pricing-v2、案C）の表から読む（2026-10-28 本人「料金プランは変わった」）。金額はここに直書きしない。
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
      <RenewalLpV2
        toolCount={getListedServiceCount()}
        pricing={{
          freeMembers: FREE_MAX_MEMBERS,
          freeStart: DAILY_RECOVERY_CAP,
          freeDaily: DAILY_RECOVERY_AMOUNT,
          teamBase: TEAM_BASE_MONTHLY,
          seat: TEAM_SEAT_TIERS[0].unitMonthly,
          seatFrom: TEAM_SEAT_TIERS[0].upTo + 1,
          seatLater: TEAM_SEAT_TIERS[1].unitMonthly,
          enterpriseFrom: ENTERPRISE_MIN_SEATS,
          yearlyFreeMonths: YEARLY_FREE_MONTHS,
          pointsBase: TEAM_MONTHLY_POINTS_BASE,
          pointsPerSeat: TEAM_MONTHLY_POINTS_PER_SEAT,
          packPoints: POWER_PACK.points,
          packPrice: POWER_PACK.price,
        }}
      />
    </div>
  );
}
