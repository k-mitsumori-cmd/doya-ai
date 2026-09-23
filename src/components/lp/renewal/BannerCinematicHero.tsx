"use client";

import { ServiceCinematicHero } from "./ServiceCinematicHero";

export function BannerCinematicHero(props: {
  ctaHref: string;
  ctaLabel?: string;
  subCtaHref?: string;
  freeLimit: string;
}) {
  return (
    <ServiceCinematicHero
      {...props}
      serviceId="banner"
      serviceName="ドヤバナーAI"
      subCtaLabel="料金を見る"
    />
  );
}
