// ============================================
// ドヤAI商談 シナリオの既定値
// ============================================
// 一次商談の型。ホストは編集できるが、何も触らなくても成立する状態にしておく。
// （設定を全部埋めないと始められない作りにすると、誰も最初の商談に到達しない）
import type { Guardrails, Icp, Persona, Phase, Slot } from './types'

export const DEFAULT_PHASES: Phase[] = [
  {
    key: 'opening', name: 'オープニング',
    goal: '名乗り、AIが対応していることを伝え、所要時間と進め方に合意する',
    exitCondition: '相手が開始に同意した', maxTurns: 3,
  },
  {
    key: 'hearing', name: 'ヒアリング',
    goal: '現状の課題・体制・予算感・導入時期・決裁プロセスを対話で聴き取る',
    exitCondition: '必須のヒアリング項目が全て埋まった', maxTurns: 14,
  },
  {
    key: 'proposal', name: '提案',
    goal: '聴き取った課題に紐づけて、資料に基づいた説明をする',
    exitCondition: '主要な提案ポイントを説明し終えた', maxTurns: 8,
  },
  {
    key: 'qa', name: '質疑応答',
    goal: '相手の疑問と不安を、資料を根拠に解消する',
    exitCondition: '相手の質問が尽きた', maxTurns: 10,
  },
  {
    key: 'closing', name: 'クロージング',
    goal: '次のアクション（担当者との商談・資料送付・トライアル）を合意する',
    exitCondition: '次アクションが決まった、または明確に辞退された', maxTurns: 4,
  },
]

/** BANT＋課題。一次商談で最低限埋めたい項目 */
export const DEFAULT_SLOTS: Slot[] = [
  { key: 'challenge', label: '現在の課題', type: 'text', required: true,
    questionHint: '今いちばんお困りのことを教えてください' },
  { key: 'current_ops', label: '現状の進め方', type: 'text', required: true,
    questionHint: '今はどのように対応されていますか' },
  { key: 'team_size', label: '関わる人数・規模', type: 'text', required: false,
    questionHint: '何名くらいで担当されていますか' },
  { key: 'budget', label: '予算感', type: 'text', required: false,
    questionHint: 'ご予算の目安はございますか' },
  { key: 'timing', label: '導入時期', type: 'text', required: true,
    questionHint: 'いつ頃までに動かしたいとお考えですか' },
  { key: 'decision', label: '決裁プロセス', type: 'text', required: false,
    questionHint: 'ご導入を決める際は、どなたが関わられますか' },
]

export const DEFAULT_ICP: Icp = {
  conditions: [
    { key: 'has_challenge', label: '解決したい課題が明確', weight: 30, match: '具体的な課題を自分の言葉で説明できている' },
    { key: 'timing', label: '導入時期が近い', weight: 25, match: '3ヶ月以内に動かしたいと述べている' },
    { key: 'budget', label: '予算の目処がある', weight: 20, match: '予算がある、または確保の見通しを述べている' },
    { key: 'authority', label: '決裁に関与している', weight: 15, match: '本人が決裁者、または決裁プロセスを把握している' },
    { key: 'scale', label: '規模が合っている', weight: 10, match: '想定顧客の規模に当てはまる' },
  ],
}

export const DEFAULT_GUARDRAILS: Guardrails = {
  pricePolicy: 'rough',
  competitorPolicy: 'neutral',
  prohibitedTopics: ['訴訟・係争中の案件', '未発表の機能や計画', '他社の顧客名', '社内の人事情報'],
  noEvidenceBehavior: 'defer',
}

export const DEFAULT_PERSONA: Persona = {
  tone: '丁寧な敬語。落ち着いた話し方で、専門用語は言い換える',
  firstPerson: '私',
  maxCharsPerUtterance: 120,
}
