'use client'

import { ComponentType } from 'react'
import ElegantFade from './ElegantFade'
import DynamicSplit from './DynamicSplit'
import CinematicReveal from './CinematicReveal'
import ParticleBurst from './ParticleBurst'
import CorporateSlide from './CorporateSlide'
import LuxuryMorph from './LuxuryMorph'
import TypewriterReveal from './TypewriterReveal'
import GlitchWave from './GlitchWave'
import ZoomRotate from './ZoomRotate'
import GradientWipe from './GradientWipe'
import TextScramble from './TextScramble'
import NeonGlow from './NeonGlow'

export interface TemplateProps {
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
  texts: { headline: string; subtext: string; cta: string }
  logo: { url: string | null; base64: string | null; alt: string | null }
  timing: { duration: number; stagger: number; easing: string }
  showLogo: boolean
  showCTA: boolean
  isPlaying: boolean
  onComplete?: () => void
  containerMode?: 'fullscreen' | 'contained'
}

const TEMPLATE_REGISTRY: Record<string, ComponentType<TemplateProps>> = {
  'elegant-fade': ElegantFade as ComponentType<TemplateProps>,
  'dynamic-split': DynamicSplit as ComponentType<TemplateProps>,
  'cinematic-reveal': CinematicReveal as ComponentType<TemplateProps>,
  'particle-burst': ParticleBurst as ComponentType<TemplateProps>,
  'corporate-slide': CorporateSlide as ComponentType<TemplateProps>,
  'luxury-morph': LuxuryMorph as ComponentType<TemplateProps>,
  'typewriter-reveal': TypewriterReveal as ComponentType<TemplateProps>,
  'glitch-wave': GlitchWave as ComponentType<TemplateProps>,
  'zoom-rotate': ZoomRotate as ComponentType<TemplateProps>,
  'gradient-wipe': GradientWipe as ComponentType<TemplateProps>,
  'text-scramble': TextScramble as ComponentType<TemplateProps>,
  'neon-glow': NeonGlow as ComponentType<TemplateProps>,
}

export function getTemplateComponent(templateId: string): ComponentType<TemplateProps> | null {
  return TEMPLATE_REGISTRY[templateId] || null
}
