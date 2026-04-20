import { HeroSection } from '@/components/allinone/HeroSection'
import { FeatureShowcase } from '@/components/allinone/FeatureShowcase'
import { ServiceOrbit } from '@/components/allinone/ServiceOrbit'
import { SocialProof } from '@/components/allinone/SocialProof'
import { WhyAllinone } from '@/components/allinone/WhyAllinone'
import { CtaBanner } from '@/components/allinone/CtaBanner'

export default function AllinoneLandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      <HeroSection />
      <SocialProof />
      <FeatureShowcase />
      <ServiceOrbit />
      <WhyAllinone />
      <CtaBanner />
    </div>
  )
}
