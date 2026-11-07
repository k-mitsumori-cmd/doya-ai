'use client'
// ============================================
// 選択肢の画面（ワークスペースを選ぶ画面など）が、会話に「どれで進めるか」を聞いてもらうための部品
// ============================================
// 画面は何も描かない。会話（AgentDock）が画面を開いたとき、この選択肢を会話に出し、本人が選んだら、選んだ先の画面へ運ぶ。
// ⚠️ 選択肢は、画面が今出している一覧（その人が所属するワークスペース）と同じものだけ。AI に選ばせない。
// ⚠️ 運ぶだけで、保存はしない。運んだ先で本物のフォームが現れ、会話はそのフォームを動かす。
import { useRouter } from 'next/navigation'
import { useAgentForm } from './useAgentForm'

export interface AgentChoiceItem { id: string; label: string; href: string }

export default function AgentChoices({ formKey, prompt, items }: { formKey: string; prompt: string; items: AgentChoiceItem[] }) {
  const router = useRouter()
  useAgentForm(formKey, {
    ready: () => items.length > 0,
    choices: () => ({ prompt, options: items.map((i) => ({ id: i.id, label: i.label })) }),
    // 画面が出している一覧にある id だけ受け付ける
    choose: (id) => { const hit = items.find((i) => i.id === id); if (hit) router.push(hit.href) },
    setValue: () => false,
    snapshot: () => ({}),
    draft: () => null,
    submit: async () => ({ ok: false, error: '先に、ワークスペースを選んでください。' }),
  })
  return null
}
