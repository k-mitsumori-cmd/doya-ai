'use client'
// ============================================
// ツールのフォームが、会話から操作されるために使うフック
// ============================================
// 使い方: useAgentForm('income.contract.new', { setValue, snapshot, submit, ready })
// ⚠️ 旗が off のとき（AgentDock が無いとき）は、register しても誰も呼ばないので、画面は今のまま動く。
import { useEffect, useRef } from 'react'
import { registerAgentForm, type AgentFormHandler } from './form-bus'

export function useAgentForm(formKey: string, handler: AgentFormHandler): void {
  // 最新の state を見るため、呼び出しは毎回 ref の最新の関数へ回す（登録は1回だけ）
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => registerAgentForm(formKey, {
    setValue: (k, v) => ref.current.setValue(k, v),
    snapshot: () => ref.current.snapshot(),
    submit: () => ref.current.submit(),
    ready: () => ref.current.ready(),
  }), [formKey])
}
