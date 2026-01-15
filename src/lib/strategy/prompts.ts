// ============================================
// ドヤ戦略AI - 多層プロンプト設計
// ============================================

/**
 * System Prompt（AIディスト適用研ルール）
 * 全プロンプトの最上位に固定
 */
export const SYSTEM_PROMPT = `あなたは「マーケティング戦略を作るAI」ではありません。
あなたは「既存のマーケティング成功パターンを、条件に応じて最適に再配分・構造化するAI」です。

制約条件：
- 抽象論・精神論は禁止
- 文章量は最小、構造は最大
- すべての戦略は「図・表・フェーズ」に変換可能な形で出力する
- ユーザーは"考えたくない"。一目で理解できることを最優先する
- コンサル口調は禁止。「戦略図を描く設計者」として振る舞うこと`

/**
 * Strategy Kernel Prompt（戦略中核生成）
 * LP / URL / 前提条件を受け取る最重要プロンプト
 */
export function getStrategyKernelPrompt(input: {
  serviceUrl?: string
  businessModel?: string
  averagePrice?: string
  targetCustomer?: string
  budgetRange?: string
  salesType?: string
}): string {
  return `${SYSTEM_PROMPT}

以下の情報をもとに、
このサービスにとって「最も再現性の高いマーケティング戦略構造」を特定してください。

入力：
- サービスURL：${input.serviceUrl || '未指定'}
- ビジネスモデル：${input.businessModel || '未指定'}
- 平均単価：${input.averagePrice || '未指定'}
- 想定顧客：${input.targetCustomer || '未指定'}
- 予算レンジ：${input.budgetRange || '未指定'}
- 営業体制：${input.salesType || '未指定'}

出力ルール：
- 戦略は「フェーズ型（Phase1〜3）」で構成する
- 各フェーズは「目的 / 主施策 / KPI / 予算比率」で定義
- "流行っている施策"ではなく「この条件で勝ちやすい構造」を優先
- 文章説明は禁止、構造データのみ出力

出力形式（JSON）：
{
  "core_strategy": "戦略タイプ名（例：BtoB SaaS｜コンテンツ×広告併用型）",
  "main_levers": ["主要施策1", "主要施策2", "主要施策3"]
}`
}

/**
 * Phase Generator Prompt（フェーズ別戦略）
 */
export function getPhaseGeneratorPrompt(coreStrategy: {
  core_strategy: string
  main_levers: string[]
}): string {
  return `${SYSTEM_PROMPT}

以下の戦略コアをもとに、
マーケティング戦略をフェーズ別に展開してください。

戦略コア：
- 戦略タイプ：${coreStrategy.core_strategy}
- 主要施策：${coreStrategy.main_levers.join(', ')}

条件：
- フェーズは最大3つ
- 各フェーズは「役割が明確に違う」こと
- 同じ施策を繰り返さない

出力形式（JSON）：
{
  "phase_1": {
    "goal": "フェーズ1の目的",
    "actions": ["施策1", "施策2", "施策3"],
    "kpi": ["KPI1（数値前提）", "KPI2（数値前提）"],
    "budget_ratio": 30
  },
  "phase_2": {
    "goal": "フェーズ2の目的",
    "actions": ["施策1", "施策2", "施策3"],
    "kpi": ["KPI1（数値前提）", "KPI2（数値前提）"],
    "budget_ratio": 40
  },
  "phase_3": {
    "goal": "フェーズ3の目的",
    "actions": ["施策1", "施策2", "施策3"],
    "kpi": ["KPI1（数値前提）", "KPI2（数値前提）"],
    "budget_ratio": 30
  }
}`
}

/**
 * Visualization Prompt（UI・ダッシュボード専用）
 */
export function getVisualizationPrompt(phases: any): string {
  return `${SYSTEM_PROMPT}

以下の戦略データを、
「ダッシュボードで一瞬で理解できる構造」に変換してください。

戦略データ：
${JSON.stringify(phases, null, 2)}

ルール：
- すべて数値化する
- グラフで表現できない要素は削除
- 色分け前提でカテゴリ分解する

出力形式（JSON）：
{
  "budget_chart": [
    {"name": "施策名", "value": 予算比率},
    ...
  ],
  "kpi_chart": [
    {"name": "KPI名", "value": 目標数値, "phase": "phase_1"},
    ...
  ],
  "phase_map": [
    {"phase": "phase_1", "timeline": "0-3ヶ月", "budget": 予算比率, "kpi_count": KPI数},
    ...
  ]
}`
}

/**
 * External Research Prompt（外部調査連携用）
 */
export function getExternalResearchPrompt(productInfo: {
  serviceUrl?: string
  businessModel?: string
  targetCustomer?: string
}): string {
  return `${SYSTEM_PROMPT}

このサービスと類似する国内外のSaaSを調査し、
以下の観点で共通パターンを抽出してください。

サービス情報：
- URL：${productInfo.serviceUrl || '未指定'}
- ビジネスモデル：${productInfo.businessModel || '未指定'}
- 想定顧客：${productInfo.targetCustomer || '未指定'}

調査観点：
- 主な集客チャネル
- 価格帯
- 初期フェーズで使われている施策

出力形式（JSON）：
{
  "competitors": [
    {
      "name": "競合サービス名",
      "channels": ["チャネル1", "チャネル2"],
      "price_range": "価格帯",
      "initial_strategies": ["施策1", "施策2"]
    }
  ],
  "summary": "傾向まとめ（個別企業名の羅列は禁止）",
  "patterns": {
    "common_channels": ["共通チャネル1", "共通チャネル2"],
    "common_strategies": ["共通施策1", "共通施策2"]
  }
}

注意：
- 競合"分析"ではなく、戦略分布の抽出
- 個別企業名の羅列は禁止
- 傾向まとめのみ出力`
}
