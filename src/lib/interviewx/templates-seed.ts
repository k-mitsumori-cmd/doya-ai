// ============================================
// ドヤインタビューAI-X — プリセットテンプレート
// ============================================

export interface TemplateQuestion {
  text: string
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'RATING' | 'YES_NO'
  required: boolean
  order: number
  description?: string
  options?: string[]
}

export interface PresetTemplate {
  name: string
  description: string
  category: string
  icon: string
  defaultQuestions: TemplateQuestion[]
  promptTemplate: string
  sampleArticle?: string
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  // ========================================
  // 導入事例インタビュー
  // ========================================
  {
    name: '導入事例インタビュー',
    description: 'お客様の導入事例を記事化。課題→選定理由→導入効果→今後の展望の流れで構成。BtoB企業のマーケティングに最適。',
    category: 'CASE_STUDY',
    icon: '📊',
    defaultQuestions: [
      { text: '御社の事業内容と、ご担当者様のお役割を教えてください。', type: 'TEXTAREA', required: true, order: 1 },
      { text: '導入前に抱えていた課題や困りごとは何でしたか？', type: 'TEXTAREA', required: true, order: 2 },
      { text: '当サービスをどのようにお知りになりましたか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '他のサービスと比較して、選定の決め手は何でしたか？', type: 'TEXTAREA', required: true, order: 4 },
      { text: '導入後、具体的にどのような効果・変化がありましたか？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '数値で示せる成果があれば教えてください（例：作業時間○%削減、売上○%向上など）。', type: 'TEXTAREA', required: false, order: 6 },
      { text: '導入時に苦労した点や、工夫した点はありますか？', type: 'TEXTAREA', required: false, order: 7 },
      { text: '社内での反応・フィードバックはいかがでしたか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '今後、当サービスをどのように活用していきたいですか？', type: 'TEXTAREA', required: true, order: 9 },
      { text: '同様の課題を抱える企業へ、メッセージをお願いします。', type: 'TEXTAREA', required: true, order: 10 },
    ],
    promptTemplate: `あなたはプロのインタビューライターです。以下のアンケート回答を基に、BtoB企業のWebサイトに掲載する「導入事例記事」を作成してください。

## 記事構成
1. **タイトル**: 成果を端的に示す（例：「作業時間を50%削減——○○社が実現したDX」）
2. **リード文**: 企業名・課題・成果を3行で要約
3. **導入前の課題**: 読者が共感できるよう具体的に描写
4. **選定理由**: なぜこのサービスを選んだのか
5. **導入プロセス**: 導入時のエピソード
6. **導入効果**: 数値を含む具体的な成果
7. **今後の展望**: 将来のビジョン
8. **読者へのメッセージ**: 同業者への推薦

## ルール
- 回答者の言葉をなるべく活かす（一人称は「私たち」）
- 数値やエピソードは正確に引用
- 専門用語は必要に応じて補足
- 読みやすさを重視（1文は60文字以内目安）`,
  },

  // ========================================
  // 社員インタビュー
  // ========================================
  {
    name: '社員インタビュー',
    description: '社員の入社理由・仕事のやりがい・成長を伝える記事。採用広報・社内報に活用。',
    category: 'EMPLOYEE',
    icon: '👤',
    defaultQuestions: [
      { text: 'お名前、所属部署、入社年を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: '入社のきっかけ・決め手を教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '現在の業務内容を教えてください。', type: 'TEXTAREA', required: true, order: 3 },
      { text: '仕事で一番やりがいを感じる瞬間は？', type: 'TEXTAREA', required: true, order: 4 },
      { text: 'これまでで最も印象に残っているプロジェクトや経験は？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '入社してから成長したと感じるポイントは？', type: 'TEXTAREA', required: true, order: 6 },
      { text: '会社の雰囲気・社風をどう感じていますか？', type: 'TEXTAREA', required: true, order: 7 },
      { text: '1日のスケジュール（タイムライン）を教えてください。', type: 'TEXTAREA', required: false, order: 8 },
      { text: '今後の目標やチャレンジしたいことは？', type: 'TEXTAREA', required: true, order: 9 },
      { text: '入社を検討している方へメッセージをお願いします。', type: 'TEXTAREA', required: true, order: 10 },
    ],
    promptTemplate: `あなたはプロのインタビューライターです。以下のアンケート回答を基に、企業サイトの「社員インタビュー」記事を作成してください。

## 記事構成
1. **タイトル**: 社員の人柄や仕事への情熱が伝わるもの
2. **プロフィール紹介**: 名前・部署・入社年・簡単な経歴
3. **入社の決め手**: ストーリー仕立てで
4. **仕事内容と魅力**: 具体的なエピソード付き
5. **成長と変化**: ビフォーアフターを描写
6. **職場の雰囲気**: リアルな声
7. **今後のビジョン**: 前向きなメッセージ
8. **読者へのメッセージ**: 採用候補者向け

## ルール
- 本人の話し言葉のニュアンスを活かす
- 等身大の姿を伝える（過度な美化を避ける）
- 写真キャプション用の引用を2-3箇所抽出`,
  },

  // ========================================
  // お客様の声
  // ========================================
  {
    name: 'お客様の声',
    description: 'お客様のリアルな感想を記事化。商品・サービスの信頼性向上に。コンパクトな構成。',
    category: 'TESTIMONIAL',
    icon: '💬',
    defaultQuestions: [
      { text: 'お名前（ニックネーム可）と、簡単なプロフィールを教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: '当サービスを利用しようと思ったきっかけは？', type: 'TEXTAREA', required: true, order: 2 },
      { text: '利用前はどんな不安や期待がありましたか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '実際に利用してみて、最も良かった点を教えてください。', type: 'TEXTAREA', required: true, order: 4 },
      { text: '期待と比べて、どうでしたか？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '改善してほしい点があれば教えてください。', type: 'TEXTAREA', required: false, order: 6 },
      { text: '総合的な満足度を5段階で教えてください。', type: 'RATING', required: true, order: 7, description: '1=不満 〜 5=非常に満足' },
      { text: '友人や同僚にすすめたいですか？', type: 'YES_NO', required: true, order: 8 },
      { text: '検討中の方へ一言メッセージをお願いします。', type: 'TEXTAREA', required: true, order: 9 },
    ],
    promptTemplate: `あなたはプロのコンテンツライターです。以下のアンケート回答を基に、「お客様の声」記事を作成してください。

## 記事構成
1. **見出し**: お客様の印象的な一言を引用
2. **お客様紹介**: プロフィール（匿名配慮）
3. **利用のきっかけ**: 課題や背景
4. **利用した感想**: 良かった点を中心に
5. **おすすめポイント**: 他の人への推薦理由

## ルール
- お客様のリアルな言葉を最大限活かす
- コンパクトに（800-1500文字程度）
- ネガティブな意見も正直に（ただし建設的な表現で）
- 満足度スコアを明記`,
  },

  // ========================================
  // 採用インタビュー
  // ========================================
  {
    name: '採用インタビュー',
    description: '採用ページ向けの社員紹介。キャリアパス・成長環境・働く魅力を深掘り。',
    category: 'RECRUIT',
    icon: '🎯',
    defaultQuestions: [
      { text: 'お名前、職種、入社年を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: '前職の経験と、転職を考えた理由を教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: '入社の決め手は何でしたか？', type: 'TEXTAREA', required: true, order: 3 },
      { text: '入社前と入社後でギャップはありましたか？', type: 'TEXTAREA', required: true, order: 4 },
      { text: '現在の仕事内容と、やりがいを教えてください。', type: 'TEXTAREA', required: true, order: 5 },
      { text: 'どんなスキルが身につきましたか？成長を感じるポイントは？', type: 'TEXTAREA', required: true, order: 6 },
      { text: 'チームや上司との関係性、社風について教えてください。', type: 'TEXTAREA', required: true, order: 7 },
      { text: 'ワークライフバランスはいかがですか？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '今後のキャリアビジョンを教えてください。', type: 'TEXTAREA', required: true, order: 9 },
      { text: '候補者の方へメッセージをお願いします。', type: 'TEXTAREA', required: true, order: 10 },
    ],
    promptTemplate: `あなたはプロの採用広報ライターです。以下のアンケート回答を基に、採用ページ向けの「社員インタビュー」記事を作成してください。

## 記事構成
1. **タイトル**: 働く魅力が伝わるキャッチコピー
2. **プロフィール**: 名前・職種・入社年
3. **キャリアストーリー**: 前職→転職→現在
4. **仕事の魅力**: 具体的なエピソード
5. **成長環境**: スキルアップ・キャリアパス
6. **カルチャー**: チーム・社風のリアル
7. **候補者へのメッセージ**: 背中を押す言葉

## ルール
- 採用候補者が「この会社で働きたい」と思える内容
- 嘘くさくならない等身大の言葉
- Q&A形式 or ストーリー形式を回答内容に応じて選択`,
  },

  // ========================================
  // プレスリリース
  // ========================================
  {
    name: 'プレスリリース',
    description: '新サービス・新機能・イベント告知用のプレスリリース。報道関係者向けの構成。',
    category: 'PRESS',
    icon: '📰',
    defaultQuestions: [
      { text: '発表する内容を一言で教えてください（新サービス名/イベント名など）。', type: 'TEXT', required: true, order: 1 },
      { text: '発表の背景・開発のきっかけを教えてください。', type: 'TEXTAREA', required: true, order: 2 },
      { text: 'サービス/プロダクトの主な特徴・機能を3つ以上教えてください。', type: 'TEXTAREA', required: true, order: 3 },
      { text: '想定するターゲットユーザー・顧客は？', type: 'TEXTAREA', required: true, order: 4 },
      { text: '価格・プラン体系があれば教えてください。', type: 'TEXTAREA', required: false, order: 5 },
      { text: '提供開始日・展開スケジュールを教えてください。', type: 'TEXT', required: true, order: 6 },
      { text: '代表者または責任者のコメントをお願いします。', type: 'TEXTAREA', required: true, order: 7 },
      { text: '今後の展開・ビジョンを教えてください。', type: 'TEXTAREA', required: true, order: 8 },
      { text: '会社概要（社名・所在地・設立・代表者・URL）を教えてください。', type: 'TEXTAREA', required: true, order: 9 },
    ],
    promptTemplate: `あなたはプロのPRライターです。以下のアンケート回答を基に、報道機関・メディア向けの「プレスリリース」を作成してください。

## 記事構成
1. **タイトル**: ニュース価値を端的に示す（40文字以内）
2. **サブタイトル**: 補足情報
3. **リード**: 5W1H を網羅した要約（3-4行）
4. **背景・課題**: なぜ今このリリースなのか
5. **サービス/プロダクト詳細**: 特徴・機能
6. **ターゲット・利用シーン**: 誰がどう使うか
7. **代表者コメント**: 引用形式
8. **今後の展開**: ロードマップ
9. **会社概要**: 基本情報一覧

## ルール
- 客観的・事実ベースの文体
- 数値や日付は正確に
- 専門用語は初出時に説明
- 「です・ます」調で統一`,
  },

  // ========================================
  // イベントレポート
  // ========================================
  {
    name: 'イベントレポート',
    description: 'セミナー・展示会・社内イベントの振り返り記事。臨場感のあるレポート。',
    category: 'EVENT',
    icon: '🎪',
    defaultQuestions: [
      { text: 'イベント名と開催日・場所を教えてください。', type: 'TEXT', required: true, order: 1 },
      { text: 'イベントの目的・テーマは何でしたか？', type: 'TEXTAREA', required: true, order: 2 },
      { text: '参加者数や対象者を教えてください。', type: 'TEXT', required: true, order: 3 },
      { text: 'プログラム・タイムラインを教えてください。', type: 'TEXTAREA', required: true, order: 4 },
      { text: '最も盛り上がったセッション・ハイライトは？', type: 'TEXTAREA', required: true, order: 5 },
      { text: '登壇者や参加者の印象的な発言・エピソードがあれば教えてください。', type: 'TEXTAREA', required: true, order: 6 },
      { text: '参加者からの反響・フィードバックはいかがでしたか？', type: 'TEXTAREA', required: true, order: 7 },
      { text: '主催者として得られた学び・気づきは？', type: 'TEXTAREA', required: false, order: 8 },
      { text: '次回開催の予定やお知らせがあれば教えてください。', type: 'TEXTAREA', required: false, order: 9 },
    ],
    promptTemplate: `あなたはプロのイベントレポーターです。以下のアンケート回答を基に、臨場感のある「イベントレポート」記事を作成してください。

## 記事構成
1. **タイトル**: イベントの魅力が伝わるキャッチ
2. **概要**: イベント名・日時・場所・参加者数
3. **イベントの背景**: 開催目的・テーマ
4. **ハイライト**: 盛り上がったセッション・エピソード
5. **参加者の声**: リアルな反応
6. **主催者の振り返り**: 学びと気づき
7. **次回告知**: 今後の展開

## ルール
- 臨場感を出すために現在形も活用
- 登壇者の発言は引用形式で
- 写真キャプション用の説明を適宜追加
- 記事が長くなりすぎないよう要点を絞る`,
  },
]
