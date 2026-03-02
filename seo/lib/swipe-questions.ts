/**
 * スワイプ質問ツリー定義
 * 条件分岐はフロント側で判定（ラグレス必須）
 */

export type SwipeDecision = 'yes' | 'no' | 'hold'

export interface SwipeQuestion {
  id: string
  category: string
  question: string
  description?: string
  conditions?: {
    dependsOn: string // 依存する質問ID
    value: SwipeDecision | SwipeDecision[] // 条件値
  }[]
  next?: string[] // 次の質問ID（条件分岐）
}

export const SWIPE_QUESTIONS: SwipeQuestion[] = [
  // 基本情報
  {
    id: 'q1',
    category: 'basic',
    question: '記事の文字数はどのくらいにしますか？',
    description: 'SEO効果を考慮した推奨文字数',
  },
  {
    id: 'q2',
    category: 'basic',
    question: '記事のタイプを選んでください',
    description: '読者の検索意図に合わせた記事形式',
  },
  {
    id: 'q3',
    category: 'basic',
    question: '対象読者はどちらですか？',
    description: 'BtoB（企業向け）かBtoC（個人向け）か',
  },
  {
    id: 'q4',
    category: 'basic',
    question: '読者の知識レベルは？',
    description: '初心者向けか上級者向けか',
  },
  {
    id: 'q5',
    category: 'basic',
    question: '商用色の強さは？',
    description: '営業色の強さを選択',
  },

  // 構成要素
  {
    id: 'q6',
    category: 'structure',
    question: '料金比較を入れますか？',
    description: 'サービス・ツールの料金比較表',
    conditions: [
      { dependsOn: 'q2', value: ['yes', 'hold'] }, // 比較記事または保留の場合のみ
    ],
  },
  {
    id: 'q7',
    category: 'structure',
    question: '機能比較表を入れますか？',
    description: '複数サービスの機能を比較',
    conditions: [
      { dependsOn: 'q2', value: ['yes', 'hold'] },
    ],
  },
  {
    id: 'q8',
    category: 'structure',
    question: '選び方のチェックリストを入れますか？',
    description: '読者が自分で選べる判断基準',
  },
  {
    id: 'q9',
    category: 'structure',
    question: 'よくある質問（FAQ）を入れますか？',
    description: '読者の疑問に答えるQ&A形式',
  },
  {
    id: 'q10',
    category: 'structure',
    question: '用語集を入れますか？',
    description: '専門用語の解説コーナー',
  },
  {
    id: 'q11',
    category: 'structure',
    question: '導入事例・実績を入れますか？',
    description: '具体的な使用例や成果',
  },
  {
    id: 'q12',
    category: 'structure',
    question: 'メリット・デメリットを入れますか？',
    description: '客観的な評価ポイント',
  },
  {
    id: 'q13',
    category: 'structure',
    question: '手順・ステップを入れますか？',
    description: 'HowTo形式の手順解説',
    conditions: [
      { dependsOn: 'q2', value: 'yes' }, // HowTo記事の場合のみ
    ],
  },
  {
    id: 'q14',
    category: 'structure',
    question: 'ランキング形式にしますか？',
    description: 'おすすめ順のランキング表示',
    conditions: [
      { dependsOn: 'q2', value: ['yes', 'hold'] },
    ],
  },
  {
    id: 'q15',
    category: 'structure',
    question: 'まとめ・結論を最初に表示しますか？',
    description: '結論ファースト形式',
  },
  {
    id: 'q16',
    category: 'structure',
    question: '引用・根拠を入れますか？',
    description: '信頼性を高める引用情報',
  },
  {
    id: 'q17',
    category: 'structure',
    question: '反論に答えるセクションを入れますか？',
    description: '読者の懸念点に答える',
  },
  {
    id: 'q18',
    category: 'structure',
    question: '実務テンプレートを入れますか？',
    description: 'すぐ使えるチェックリスト・例文',
  },
]

/**
 * 質問ツリーの開始点を取得
 */
export function getInitialQuestions(): SwipeQuestion[] {
  return SWIPE_QUESTIONS.filter((q) => !q.conditions || q.conditions.length === 0)
}

/**
 * 条件を満たす質問かどうかを判定
 */
export function shouldShowQuestion(
  question: SwipeQuestion,
  swipeLog: Record<string, SwipeDecision>
): boolean {
  if (!question.conditions || question.conditions.length === 0) {
    return true
  }

  // すべての条件を満たす必要がある（AND条件）
  return question.conditions.every((condition) => {
    const dependentValue = swipeLog[condition.dependsOn]
    if (!dependentValue) return false

    if (Array.isArray(condition.value)) {
      return condition.value.includes(dependentValue)
    }
    return dependentValue === condition.value
  })
}

/**
 * 利用可能な質問を取得（条件分岐を考慮）
 */
export function getAvailableQuestions(
  swipeLog: Record<string, SwipeDecision>
): SwipeQuestion[] {
  return SWIPE_QUESTIONS.filter((q) => shouldShowQuestion(q, swipeLog))
}

/**
 * まだ回答していない質問を取得
 */
export function getUnansweredQuestions(
  swipeLog: Record<string, SwipeDecision>
): SwipeQuestion[] {
  const answeredIds = new Set(Object.keys(swipeLog))
  return getAvailableQuestions(swipeLog).filter((q) => !answeredIds.has(q.id))
}
