'use client'
// ============================================
// Remotion エントリーポイント
// ============================================
import { Composition } from 'remotion'
import { MovieComposition } from './MovieComposition'
import type { CompositionConfig } from '../types'

const defaultConfig: CompositionConfig = {
  projectId: 'preview',
  scenes: [],
  aspectRatio: '16:9',
  totalDuration: 15,
  fps: 30,
  watermark: true,
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MovieComposition"
        component={MovieComposition as React.ComponentType<{ config: CompositionConfig }>}
        durationInFrames={450} // デフォルト15秒×30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ config: defaultConfig }}
      />
    </>
  )
}
