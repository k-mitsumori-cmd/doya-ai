interface EvaluationCommentContext {
  employeeName: string
  position?: string | null
  department?: string | null
  periodName: string
  goals?: any
  competencies?: any
  selfRating?: number | null
  managerRating?: number | null
  selfComment?: string | null
  managerComment?: string | null
}

export function buildEvaluationCommentPrompt(ctx: EvaluationCommentContext): string {
  const goalsText = ctx.goals
    ? JSON.stringify(ctx.goals, null, 2)
    : 'なし'
  const competenciesText = ctx.competencies
    ? JSON.stringify(ctx.competencies, null, 2)
    : 'なし'

  return `あなたは人事評価の専門家です。以下の評価情報に基づいて、建設的で具体的な評価コメントを生成してください。

## 対象者情報
- 氏名: ${ctx.employeeName}
- 役職: ${ctx.position || '未設定'}
- 部署: ${ctx.department || '未設定'}
- 評価期間: ${ctx.periodName}

## 目標設定
${goalsText}

## コンピテンシー評価
${competenciesText}

## 自己評価スコア: ${ctx.selfRating ?? '未入力'}
## 上司評価スコア: ${ctx.managerRating ?? '未入力'}

## 自己評価コメント
${ctx.selfComment || '未入力'}

## 上司コメント
${ctx.managerComment || '未入力'}

## 出力形式
以下の3セクションで日本語のコメントを生成してください。各セクション200〜400文字程度。

### 総合評価
- 全体的な評価を客観的にまとめる

### 強み・成果
- 具体的に認められる点を3つ程度挙げる

### 改善点・今後の期待
- 建設的な改善提案を2〜3つ挙げる
- 次期に向けた具体的なアクションを提案する

出力はMarkdown形式で記述してください。`
}

interface OneOnOneNotes {
  employeeName: string
  managerName: string
  agenda?: any
  managerNotes?: string | null
  employeeNotes?: string | null
  conductedAt?: string | null
}

export function buildOneOnOneSummaryPrompt(notes: OneOnOneNotes): string {
  const agendaText = notes.agenda
    ? JSON.stringify(notes.agenda, null, 2)
    : 'なし'

  return `あなたは1on1ミーティングの要約を作成する人事アシスタントです。以下のミーティング記録から、簡潔で実用的な要約を作成してください。

## ミーティング情報
- 日時: ${notes.conductedAt || '未記録'}
- メンバー: ${notes.employeeName}（メンバー）× ${notes.managerName}（マネージャー）

## アジェンダ
${agendaText}

## マネージャーメモ
${notes.managerNotes || '未記録'}

## メンバーメモ
${notes.employeeNotes || '未記録'}

## 出力形式
以下の形式で日本語の要約を生成してください：

### 要約（100〜200文字）
ミーティングの概要を簡潔にまとめる

### 主なトピック
- 話し合われた主要なテーマを箇条書き

### アクションアイテム
- 具体的なタスクと担当者を箇条書き

### フォローアップ事項
- 次回確認すべき事項

出力はMarkdown形式で記述してください。`
}
