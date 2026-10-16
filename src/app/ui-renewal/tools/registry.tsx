'use client'

// サービスID → 作業画面。画面ごとに分けて読み込む（最初の表示を軽くするため）
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

const load = (f: () => Promise<{ default: ComponentType }>) => dynamic(f, { ssr: false })

export const SERVICE_TOOLS: Record<string, ComponentType> = {
  adimage: load(() => import('./adimage')),
  interview: load(() => import('./interview')),
  persona: load(() => import('./persona')),
  aio: load(() => import('./aio')),
  asklink: load(() => import('./asklink')),
  doyaslide: load(() => import('./doyaslide')),
  doyalist: load(() => import('./doyalist')),
  shodan: load(() => import('./shodan')),
  aishodan: load(() => import('./aishodan')),
  quote: load(() => import('./quote')),
  sfa: load(() => import('./sfa')),
  cunning: load(() => import('./cunning')),
  mensetsu: load(() => import('./mensetsu')),
  hr: load(() => import('./hr')),
  kintai: load(() => import('./kintai')),
  promane: load(() => import('./promane')),
}
