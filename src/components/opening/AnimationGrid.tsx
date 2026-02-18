'use client'

import AnimationCard from './AnimationCard'

interface AnimationData {
  id: string
  templateId: string
  name: string
  nameEn: string
  description: string
  isPro: boolean
  config: {
    colors: { primary: string; secondary: string; background: string }
  }
}

interface AnimationGridProps {
  animations: AnimationData[]
  userPlan: string
  onPreview: (id: string) => void
  onSelect: (id: string) => void
}

export default function AnimationGrid({ animations, userPlan, onPreview, onSelect }: AnimationGridProps) {
  const isPro = ['PRO', 'ENTERPRISE', 'BUNDLE', 'BUSINESS'].includes(userPlan.toUpperCase())

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {animations.map((anim) => (
        <AnimationCard
          key={anim.id}
          templateId={anim.templateId}
          name={anim.name}
          nameEn={anim.nameEn}
          description={anim.description}
          isPro={anim.isPro}
          isLocked={anim.isPro && !isPro}
          colors={anim.config.colors}
          onPreview={() => onPreview(anim.id)}
          onSelect={() => onSelect(anim.id)}
        />
      ))}
    </div>
  )
}
