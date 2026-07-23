import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import InterviewXLayout from '@/components/interviewx/InterviewXLayout'

export const metadata: Metadata = buildServiceMetadata('interviewx', {
  keywords: ['AIヒヤリング', 'ヒヤリング自動化', '商談準備', '要件定義', '顧客満足度調査', 'AIチャット', '自動要約', 'BtoB営業'],
})

const SVC = getServiceById('interviewx')!

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <InterviewXLayout>
        {children}
      </InterviewXLayout>
    </>
  )
}
