import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceById } from "@/lib/services";

// Render the same public LP even when the comparison viewer is signed in.
// This route never mounts authenticated app screens or reads customer data.
const pages = {
  banner: () => import("@/app/banner/landing/page"),
  seo: () => import("@/app/seo/Lp"),
  interview: () => import("@/app/interview/Lp"),
  persona: () => import("@/app/persona/Lp"),
  hr: () => import("@/app/hr/page"),
  kintai: () => import("@/app/kintai/page"),
  doyalist: () => import("@/app/doyalist/Lp"),
  promane: async () => ({
    default: (await import("@/app/promane/PromaneLp")).PromaneLp,
  }),
  doyaslide: () => import("@/app/doyaslide/Lp"),
  cunning: () => import("@/app/cunning/Lp"),
  sfa: () => import("@/app/sfa/Lp"),
  shodan: () => import("@/app/shodan/Lp"),
  aio: () => import("@/app/aio/Lp"),
  mensetsu: () => import("@/app/mensetsu/Lp"),
  quote: () => import("@/app/quote/Lp"),
  aishodan: () => import("@/app/aishodan/Lp"),
  adimage: () => import("@/app/adimage/Lp"),
};

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((service) => ({ service }));
}

export function generateMetadata({
  params,
}: {
  params: { service: string };
}): Metadata {
  const service = getServiceById(params.service);
  return {
    title: `${service?.name ?? "サービス"} | LP比較用プレビュー`,
    robots: { index: false, follow: true },
    alternates: { canonical: `https://doya-ai.surisuta.jp/${params.service}` },
  };
}

export default async function RenewalPreview({
  params,
}: {
  params: { service: string };
}) {
  if (!Object.prototype.hasOwnProperty.call(pages, params.service)) notFound();
  const { default: Page } = await pages[params.service as keyof typeof pages]();
  return <Page />;
}
