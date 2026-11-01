import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceById, isBetaHiddenService } from "@/lib/services";

// Render the same public LP even when the comparison viewer is signed in.
// This route never mounts authenticated app screens or reads customer data.
const pages = {
  banner: () => import("@/app/(shell)/banner/landing/page"),
  seo: () => import("@/app/(shell)/seo/Lp"),
  interview: () => import("@/app/(shell)/interview/Lp"),
  persona: () => import("@/app/(shell)/persona/Lp"),
  hr: () => import("@/app/(shell)/hr/page"),
  kintai: () => import("@/app/(shell)/kintai/page"),
  doyalist: () => import("@/app/(shell)/doyalist/Lp"),
  promane: async () => ({
    default: (await import("@/app/(shell)/promane/PromaneLp")).PromaneLp,
  }),
  doyaslide: () => import("@/app/(shell)/doyaslide/Lp"),
  cunning: () => import("@/app/(shell)/cunning/Lp"),
  sfa: () => import("@/app/(shell)/sfa/Lp"),
  shodan: () => import("@/app/(shell)/shodan/Lp"),
  aio: () => import("@/app/(shell)/aio/Lp"),
  mensetsu: () => import("@/app/(shell)/mensetsu/Lp"),
  quote: () => import("@/app/(shell)/quote/Lp"),
  aishodan: () => import("@/app/(shell)/aishodan/Lp"),
  adimage: () => import("@/app/(shell)/adimage/Lp"),
};

export const dynamicParams = false;
export function generateStaticParams() {
  // 開発中のベータ版（services.ts の hidden: 'beta'）の LP は、比較用のプレビューにも出さない
  return Object.keys(pages).filter((service) => !isBetaHiddenService(service)).map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service: serviceId } = await params;
  const service = getServiceById(serviceId);
  return {
    title: `${service?.name ?? "サービス"} | LP比較用プレビュー`,
    robots: { index: false, follow: true },
    alternates: { canonical: `https://doya-ai.surisuta.jp/${serviceId}` },
  };
}

export default async function RenewalPreview({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: serviceId } = await params;
  if (!Object.prototype.hasOwnProperty.call(pages, serviceId) || isBetaHiddenService(serviceId)) notFound();
  const { default: Page } = await pages[serviceId as keyof typeof pages]();
  return <Page />;
}
