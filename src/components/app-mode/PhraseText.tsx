'use client'
import { Fragment, type ReactNode } from 'react'
import { useAppMode } from '@/lib/app-mode/client'
import { phraseSegments } from '@/lib/app-mode/phrase'

/**
 * アプリ表示モードのときだけ、文字列の文を文節ごとに <wbr> で区切り、言葉の途中で折り返さないようにする。
 * 旗オフ・アプリでないとき、または文字列でない子は、そのまま返す（見た目も DOM も変わらない）。
 * 折り返しの CSS（word-break: keep-all）は、data-app-mode の下の ds.module.css・ToolFrame.module.css にある。
 */
export default function PhraseText({ children }: { children: ReactNode }) {
  const appMode = useAppMode()
  if (!appMode || typeof children !== 'string') return <>{children}</>
  const parts = phraseSegments(children)
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {p}
        </Fragment>
      ))}
    </>
  )
}
