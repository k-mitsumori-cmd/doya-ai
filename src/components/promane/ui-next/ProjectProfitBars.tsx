'use client'

import { DivergingBars } from '@/components/ds/charts'

export default function ProjectProfitBars({ data }: {
  data: { label: string; value: number }[]
}) {
  return (
    <DivergingBars
      label="案件ごとの利益率"
      negativeLabel="赤字"
      positiveLabel="黒字"
      positiveTone="good"
      negativeTone="negative"
      format={(n) => `${n}%`}
      data={data}
    />
  )
}
