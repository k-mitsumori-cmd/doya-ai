import type { LpProductInfo, LpPurpose, LpSectionDef } from './types'
import { PURPOSE_LABELS } from './types'

export function buildStructurePrompt(productInfo: LpProductInfo, purposes: LpPurpose[]): string {
  const purposeText = purposes.map((p) => PURPOSE_LABELS[p]).join('・')
  return `あなたはコンバージョン率を最大化するLP設計の専門家です。
読者の心理を深く理解し、「このサービスを使わないと損だ」と思わせる構成を設計してください。

## 商品情報
- 商品名: ${productInfo.name}
- 説明: ${productInfo.description}
- ターゲット: ${productInfo.target}
- 価格: ${productInfo.price || '未定'}
- CTA目的: ${productInfo.ctaGoal}
- 主な特徴:
${(productInfo.features || []).map((f) => `  - ${f}`).join('\n')}
- 解決する課題:
${(productInfo.problems || []).map((p) => `  - ${p}`).join('\n')}

## LPの目的
${purposeText}

## 心理設計の原則
1. **ファーストビューで心を掴む**: 3秒で「自分のことだ」と思わせるキャッチコピー。数字・疑問形・痛みの言語化が効果的
2. **問題提起で共感**: ターゲットが「そうそう、それで困ってた」と頷く具体的な悩みを列挙
3. **共感→解決の流れ**: 「あなたのせいではありません」→「実はこんな方法があります」の心理的ブリッジ
4. **証拠で信頼構築**: 数字（導入実績・満足度・削減率）、権威性（受賞・メディア掲載）、体験談
5. **行動の後押し**: 限定感・緊急性・リスク排除（無料体験・返金保証）でCTAを強化
6. **複数のCTA配置**: hero直下・中間・最終の最低3箇所でCTAを挟む

## 出力形式（JSONのみ）
{
  "structures": [
    {
      "id": 0,
      "name": "パターン名",
      "description": "このパターンの特徴・狙い（50字以内）",
      "sections": [
        {
          "type": "hero",
          "name": "ファーストビュー",
          "purpose": "このセクションで読者に感じさせたいこと（具体的な感情を記述）",
          "recommendedContent": ["キャッチコピー", "サブキャッチ", "CTA"],
          "headlineChars": 30,
          "bodyChars": 80,
          "hasCta": true,
          "heightRatio": 1.0
        }
      ]
    }
  ]
}

## セクションタイプ
hero, problem, empathy, solution, features, proof, testimonial, pricing, faq, cta, company, footer

## 制約
- 各パターンは8〜12セクション
- パターン1: AIDA型（注意→興味→欲求→行動の王道フロー）
- パターン2: PAS型（問題→煽り→解決策で課題解決を強調）
- パターン3: ストーリー型（共感→発見→変化のナラティブ）
- 必ずheroとfooterを含める
- CTAセクションは最低2箇所（hero内+後半）配置
- purposeに「読者にこう感じてほしい」という具体的な感情を書く
- JSONのみ出力`
}

/** セクションタイプ別のコピーライティング指示 */
function getSectionCopyGuidance(type: string): string {
  switch (type) {
    case 'hero':
      return `【ファーストビュー】読者の人生を変える一文を書け。
- 見出しは「数字」「疑問形」「痛みの言語化」のいずれかを含める
- 「○○で悩んでいませんか？」「たった○日で○○が○○%改善」のような具体性
- サブ見出しで「なぜそれが可能か」の根拠を一行で示す
- CTAは「無料で始める」「今すぐ体験」など行動のハードルを下げる表現`
    case 'problem':
      return `【問題提起】読者が「あ、自分のことだ…」と思わず立ち止まるリアルな悩みを書け。
- 具体的なシーンを描写（「毎月の○○に○時間かけていませんか？」）
- 数字で痛みを可視化（「年間○万円の損失」「○%の企業が失敗」）
- 3つの悩みは段階的にエスカレートさせる（軽い→深刻→致命的）`
    case 'empathy':
      return `【共感】読者を責めず、味方になる。「あなたのせいじゃない」というメッセージ。
- 「多くの方が同じ悩みを抱えています」で孤独感を解消
- 失敗の原因を外部要因に帰属（「従来の方法には限界がありました」）
- 希望の光を暗示（「でも、もう大丈夫です」）`
    case 'solution':
      return `【解決策】「これだ！」と膝を打つ瞬間を演出。
- 商品名を英雄として登場させる（「○○なら、その悩みを根本から解決します」）
- Before→Afterを対比で見せる
- 「なぜ今までなかったのか」という驚きの要素`
    case 'features':
      return `【特徴・強み】スペックではなくベネフィットを語れ。
- 「AIが自動で」→「あなたは○○するだけ。あとはAIが○分で完了」
- 各特徴は「機能名→その結果どう変わるか」の構造
- 競合との差別化ポイントを暗示（「業界初」「唯一」「○倍」）`
    case 'proof':
      return `【実績・証拠】数字で信頼を積み上げろ。
- 導入企業数、満足度、改善率など具体的な数字を太字級に
- 「○社が導入」「満足度○%」「○倍の成果」の3点セット
- 権威づけ（メディア掲載、受賞歴、専門家の推薦）があれば強調`
    case 'testimonial':
      return `【お客様の声】リアルな体験談で背中を押せ。
- 具体的な変化を数字で語る（「月○万円のコスト削減」「作業時間が○分の1に」）
- 業種・役職を明示して共感させる（「IT企業マーケ担当」「飲食店オーナー」）
- 懐疑→導入→感動の3段構成
- 「もっと早く出会いたかった」のような感情的な一言を含める`
    case 'pricing':
      return `【料金】「この価格でこの内容？安い！」と思わせる見せ方。
- 比較対象を示す（「従来の○○なら月○万円→本サービスは○円から」）
- 無料プランや試用期間があれば目立たせる
- 「1日あたりたった○円」のような割り算トリック`
    case 'faq':
      return `【よくある質問】購入直前の不安を先回りで潰せ。
- 「本当に効果ある？」→具体的な数字と事例で回答
- 「解約できる？」→簡単さを強調
- 「難しくない？」→サポート体制で安心感
- 質問文にもターゲットの言葉遣いを反映`
    case 'cta':
      return `【最終CTA】「今すぐ行動しないと損」という切迫感を演出。
- 見出しは行動を促す命令形or疑問形（「まだ○○で消耗してますか？」）
- 限定性（「今月限定」「先着○社」）や保証（「30日間全額返金」）を盛り込む
- CTAボタンは「無料で○○する」「○秒で登録完了」など心理的ハードルを下げる
- ボタン下に「※クレジットカード不要」などの安心材料`
    case 'company':
      return `【会社情報】信頼性と専門性を簡潔に伝える。
- ミッション・ビジョンを一文で
- 実績数字（創業○年、○社以上のサポート実績）`
    case 'footer':
      return `【フッター】最後の行動喚起。CTAリンクとコピーライト。`
    default:
      return `読者の感情を動かし、次のセクションに読み進めたくなるコピーを書いてください。`
  }
}

export function buildCopyPrompt(
  productInfo: LpProductInfo,
  section: LpSectionDef,
  purposes: LpPurpose[]
): string {
  const purposeText = purposes.map((p) => PURPOSE_LABELS[p]).join('・')
  const guidance = getSectionCopyGuidance(section.type)
  return `あなたは年商100億円企業のLPを手掛ける、日本トップクラスのセールスコピーライターです。
読者の心に「ぶっ刺さる」コピーを書いてください。平凡な表現は禁止。読者が思わず行動したくなる言葉を選べ。

## あなたのコピーライティング原則
1. **具体性が命**: 「多くの」→「847社の」、「すぐに」→「最短3分で」、「安い」→「月額980円から」
2. **ベネフィット優先**: 機能ではなく「その機能で読者の人生がどう変わるか」を語る
3. **感情トリガー**: 恐怖（このままだと…）、欲望（○○が手に入る）、希少性（限定○社）、権威性（○○推薦）
4. **パワーワード活用**: 「たった」「驚きの」「実は」「知らないと損する」「○○だけで」
5. **対比構造**: Before/After、従来/新しい、問題/解決を対比させて変化を際立たせる

## 商品情報
- 商品名: ${productInfo.name}
- 説明: ${productInfo.description}
- ターゲット: ${productInfo.target}
- 価格: ${productInfo.price || '未定'}
- CTA目的: ${productInfo.ctaGoal}
- LP目的: ${purposeText}
- 主な特徴: ${(productInfo.features || []).join(' / ')}
- 解決する課題: ${(productInfo.problems || []).join(' / ')}

## 対象セクション
- セクション名: ${section.name}
- 目的: ${section.purpose}
- 推奨コンテンツ: ${(section.recommendedContent || []).join('、')}

## このセクションのコピー指示
${guidance}

## 出力形式（JSONのみ）
{
  "headline": "見出し（${section.headlineChars}文字前後。パワーワード・数字を含む、読者の心を鷲掴みにする一文）",
  "subheadline": "サブ見出し（見出しを補強する具体的な一文）",
  "body": "本文（${section.bodyChars}文字前後。読者が自分ごととして読める、感情を動かす文章）",
  "ctaText": ${section.hasCta ? '"CTAボタンテキスト（「～する」の行動形。8文字以内）"' : 'null'},
  "items": []
}

## 絶対NG
- 「お気軽にお問い合わせください」のような無個性な定型文
- 主語が曖昧な文章（「弊社は」「当サービスは」の連発）
- 抽象的すぎる表現（「高品質」「充実のサポート」「圧倒的」を具体化せよ）
- itemsはfeatures/testimonial/faq/proofセクションのみ3〜5件（{ "title": "", "description": "" }形式）
- JSONのみ出力`
}

export function buildBrushupPrompt(
  productInfo: LpProductInfo,
  sectionName: string,
  currentCopy: { headline?: string | null; body?: string | null },
  instruction: string
): string {
  return `あなたは日本トップクラスのセールスコピーライターです。
既存のコピーを「もっと刺さる」表現にブラッシュアップしてください。

## ブラッシュアップの基本方針
- 抽象的な表現は数字や具体例に置き換える
- 読者が「自分のことだ」と感じる言葉遣いにする
- パワーワード（たった/驚きの/実は/知らないと損/○○だけで）を効果的に使う
- Before/Afterの対比を入れて変化を際立たせる

## 商品情報
- 商品名: ${productInfo.name}
- ターゲット: ${productInfo.target}

## セクション: ${sectionName}

## 現在のコピー
見出し: ${currentCopy.headline || '（なし）'}
本文: ${currentCopy.body || '（なし）'}

## ユーザーからの修正指示
${instruction}

## 出力形式（JSONのみ）
{
  "headline": "修正後の見出し（より具体的に、より感情を動かす表現に）",
  "body": "修正後の本文（読者が行動したくなる文章に）"
}

JSONのみ出力してください。`
}

export function buildAnalyzeUrlPrompt(
  url: string,
  textContent: string,
  meta?: { title?: string; ogTitle?: string; description?: string; keywords?: string }
): string {
  const metaSection = meta
    ? `## メタ情報
- ページタイトル: ${meta.title || '（なし）'}
- OGタイトル: ${meta.ogTitle || '（なし）'}
- ディスクリプション: ${meta.description || '（なし）'}
- キーワード: ${meta.keywords || '（なし）'}

`
    : ''

  const contentSection = textContent.length > 50
    ? `## ページ本文テキスト（最大15000文字）
${textContent.slice(0, 15000)}`
    : '## ページ本文テキスト\n（テキストコンテンツが少ないため、メタ情報を中心に推測してください）'

  return `以下のWebページの情報から、LP作成に必要な商品・サービス情報を抽出してください。
テキストが少ない場合は、メタ情報やURLから推測してください。

URL: ${url}

${metaSection}${contentSection}

## 出力形式（JSONのみ）
{
  "name": "商品・サービス名",
  "description": "説明（100文字以内）",
  "target": "ターゲット層",
  "price": "価格（不明なら空文字）",
  "ctaGoal": "このLPで達成したいこと",
  "features": ["特徴1", "特徴2", "特徴3"],
  "problems": ["解決する課題1", "解決する課題2"]
}

JSONのみ出力してください。`
}
