'use client'

import type { ReactNode } from 'react'
import AppShell from '@/components/shell/AppShell'
import { AccountCompanyContext } from '@/components/shell/company-context'
import { ShellToolHrefsContext, UiNextContext } from '@/components/shell/ui-next-context'
import { DoyaPowerContext } from '@/components/doya-power/doya-power-context'
import { ShellPowerProvider } from '@/components/shell/power'

const SAMPLE_TOOL_HREFS: Record<string, string> = {}

/** 合成データ専用の枠。実アカウントの会社・ポイント・組織別リンクを受け継がない。 */
export default function CollectionPreviewFrame({ children }: { children: ReactNode }) {
  return (
    <UiNextContext.Provider value="preview">
      <AccountCompanyContext.Provider value={undefined}>
        <ShellToolHrefsContext.Provider value={SAMPLE_TOOL_HREFS}>
          <DoyaPowerContext.Provider value={false}>
            <ShellPowerProvider value={null}>
              <AppShell userName="サンプル">{children}</AppShell>
            </ShellPowerProvider>
          </DoyaPowerContext.Provider>
        </ShellToolHrefsContext.Provider>
      </AccountCompanyContext.Provider>
    </UiNextContext.Provider>
  )
}
