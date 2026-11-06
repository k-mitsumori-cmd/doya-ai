'use client'
// ============================================
// 今の人には操作できない画面（権限がないなど）が、会話に理由を伝えるための部品
// ============================================
// 画面は何も描かない。会話（AgentDock）が画面を開いたとき、値を入れる前にこの理由を出して止まる（form-bus の blocked）。
// ⚠️ 判定は、画面が今していること（ロールの確認）をそのまま渡す。会話専用の判定を作らない。
import { useAgentForm } from './useAgentForm'

export default function AgentBlocked({ formKey, reason }: { formKey: string; reason: string }) {
  useAgentForm(formKey, {
    ready: () => true,
    blocked: () => reason,
    setValue: () => false,
    snapshot: () => ({}),
    submit: async () => ({ ok: false, error: reason }),
  })
  return null
}
