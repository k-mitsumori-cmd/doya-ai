import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceById } from "@/lib/services";

// Render the same public LP even when the comparison viewer is signed in.
// This route never mounts authenticated app screens or reads customer data.
const pages = {
  banner: () => import("@/app/(shell)/banner/landing/page"),
  seo: () => import("@/app/(shell)/seo/Lp"),
  interview: () => import("@/app/(shell)/interview/Lp"),
  persona: () => import("@/app/(shell)/persona/Lp"),
  hr: () => import("@/app/hr/page"),
  kintai: () => import("@/app/kintai/page"),
  doyalist: () => import("@/app/(shell)/doyalist/Lp"),
  promane: async () => ({
    default: (await import("@/app/promane/PromaneLp")).PromaneLp,
  }),
  doyaslide: () => import("@/app/(shell)/doyaslide/Lp"),
  cunning: () => import("@/app/(shell)/cunning/Lp"),
  sfa: () => import("@/app/sfa/Lp"),
  shodan: () => import("@/app/shodan/Lp"),
  aio: () => import("@/app/aio/Lp"),
  mensetsu: () => import("@/app/mensetsu/Lp"),
  quote: () => import("@/app/(shell)/quote/Lp"),
  aishodan: () => import("@/app/aishodan/Lp"),
  adimage: () => import("@/app/(shell)/adimage/Lp"),
};

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((service) => ({ service }));
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
  if (!Object.prototype.hasOwnProperty.call(pages, serviceId)) notFound();
  const { default: Page } = await pages[serviceId as keyof typeof pages]();
  return <Page />;
}
