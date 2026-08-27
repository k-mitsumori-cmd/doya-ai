import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve('reference/generated-assets/2026-08-24-doyamarke-service-banners')
const SPECS = path.join(ROOT, 'specs')

const common = {
  aspect_ratio: '16:9',
  type: 'BtoB SaaS advertising banner',
  cta: '無料ではじめる',
}

const services = [
  {
    id: 'seo', name: 'ドヤ記事作成', category: 'SEO / LLMO content', colors: ['#2563EB', '#0F172A'],
    headline: ['検索意図から組み立てて、', '長文でも破綻しない。'],
    support: ['キーワードと参考URLから検索意図に沿う構成を設計。', '章ごとに整合性を確かめながら長文を生成。'],
    features: ['検索意図を先に整理', '章ごとに筋を通す', '公開前に自動監査'],
    summary: 'キーワードと参考URLから検索意図に沿うアウトラインを作り、章ごとの整合性を確認しながら長文記事を生成するSEO・LLMO向けサービス。',
    target: 'SEO記事を継続制作するマーケティング担当者・編集者', problem: '長文記事の構成・品質・根拠確認が属人化し、量産しにくい。', benefit: '検索意図の整理から構成、分割生成、公開前監査までを一つの流れにする。',
    mascot: ['タブレット', 'スタイラス'], pose: 'タブレットを持ち、スタイラスでアウトライン画面を説明する', expression: 'focused and friendly', mainScreen: 'アウトライン生成画面', layout: 'copy left; large product UI right 62%; mascot points from lower center; CTA lower left',
  },
  {
    id: 'doyalist', name: 'ドヤリスト', category: 'Sales intelligence', colors: ['#0D9488', '#0F172A'],
    headline: ['営業リストを作って、', '送る文面まで。'],
    support: ['法人情報から企業リストを作成。', 'メール・フォーム・電話の文面まで用意。'],
    features: ['狙う条件を決める', '出所のある企業情報', '企業別の文面まで'],
    summary: '条件に合う法人情報を企業リストに整理し、企業別のフォーム営業文・メール・電話スクリプトまで作る営業支援サービス。',
    target: '新規開拓を行う営業・マーケティング担当者', problem: '営業リスト作成と企業別の文面作成に時間がかかる。', benefit: '出所のある企業情報から、実行に使う文面まで一気通貫で用意する。',
    mascot: ['虫眼鏡', '営業メールの封筒'], pose: '虫眼鏡で企業リストを確認し、反対の手に営業メールの封筒を持つ', expression: 'confident and helpful', mainScreen: '企業候補一覧画面', layout: 'headline top left; product UI right 58%; mascot between copy and UI; CTA left bottom',
  },
  {
    id: 'hr', name: 'ドヤHR', category: 'HR Tech / talent management', colors: ['#7C3AED', '#0F172A'],
    headline: ['人を活かすのは、', 'AIとデータ。'],
    support: ['従業員DB・組織図・人事評価を一元管理。', 'AIが評価コメントの作成まで支援。'],
    features: ['顔写真中心の従業員DB', '組織図を自動生成', 'AIが人事評価を支援'],
    summary: '従業員データベース、組織図、MBO評価、1on1記録をまとめ、AIが評価コメント作成を支援するタレントマネジメントサービス。',
    target: '中小企業の人事担当者・部門マネージャー', problem: '従業員情報・組織図・評価がExcelやメールに分散している。', benefit: '人材情報と評価を一元化し、AIで評価コメント作成の負担を軽くする。',
    mascot: ['組織図ボード', '指示棒'], pose: '組織図ボードの横に立ち、指示棒でチーム構造をプレゼンする', expression: 'professional and warm', mainScreen: '従業員データベース画面', layout: 'product UI left 54%; copy right; mascot lower right presenting toward UI; CTA right bottom',
  },
  {
    id: 'kintai', name: 'ドヤ勤怠', category: 'HR Tech / attendance', colors: ['#06B6D4', '#0F172A'],
    headline: ['勤怠管理を、', 'シンプルに。'],
    support: ['打刻・自動集計・申請承認をオールインワン。', '従業員5名まで無料。'],
    features: ['ワンクリック打刻', '勤怠を自動集計', '申請・承認をオンライン化'],
    summary: 'PC・スマートフォンからの打刻、勤務時間の自動集計、休暇・残業・打刻修正の申請承認を一画面で扱うクラウド勤怠サービス。',
    target: '少人数から勤怠管理を整えたい中小企業', problem: '打刻・集計・申請承認が別々で、手計算やメール対応が発生する。', benefit: '打刻から月次集計、申請承認までをブラウザで一元化する。',
    mascot: ['腕時計', '打刻カード'], pose: '腕時計を確認しながら打刻カードにチェックを入れる', expression: 'alert and cheerful', mainScreen: '打刻画面', layout: 'copy left 38%; product UI centered/right 52%; mascot far right lower corner; CTA left bottom',
  },
  {
    id: 'promane', name: 'ドヤプロマネ', category: 'Project management', colors: ['#4F46E5', '#0F172A'],
    headline: ['案件の進捗と利益を、', 'ひとつの画面で。'],
    support: ['ガント・カンバンで進捗を見える化。', '工数から人件費と見込み利益を自動集計。'],
    features: ['案件の条件を一つに', '進み具合を見える化', '工数から利益を確認'],
    summary: 'ガントチャートとカンバンで進捗を管理し、作業時間とメンバー単価から人件費・利益を可視化する案件管理サービス。',
    target: '複数案件を持つ制作会社・中小チーム', problem: '進捗と工数・収支を別々に管理し、案件利益を把握しにくい。', benefit: '同じ案件画面で進捗・工数・人件費・利益を確認できる。',
    mascot: ['ガントチャート', '指示棒'], pose: '大きなガントチャートを指示棒で説明し、遅延箇所を示す', expression: 'decisive and calm', mainScreen: '案件収支画面', layout: 'copy left; two overlapping UI panels right; mascot in front of panel lower center; CTA left bottom',
  },
  {
    id: 'doyaslide', name: 'ドヤスライド', category: 'AI presentation', colors: ['#2563EB', '#0F172A'],
    headline: ['テーマを入れたら、', '全ページができている。'],
    support: ['構成からビジュアルまで全ページを画像生成。', 'ページ修正とPDF書き出しも一つの画面で。'],
    features: ['用途とテーマを入力', '資料の流れを設計', '全ページを画像で生成'],
    summary: 'テーマ・用途・枚数・スタイルから資料構成を作り、全ページを画像として生成し、ページ修正とPDF出力まで行うプレゼン資料作成サービス。',
    target: '営業・提案資料を短時間で作りたい担当者', problem: '資料の構成と各ページのデザインをゼロから作る時間がない。', benefit: 'テーマ入力から構成設計、全ページ生成、PDF出力まで進める。',
    mascot: ['大きなプレゼン資料', 'レーザーポインター'], pose: '大きなプレゼンページを掲げ、レーザーポインターで見せ場を指す', expression: 'proud and energetic', mainScreen: '生成済みページ一覧画面', layout: 'headline centered upper left; product UI spans lower 64%; mascot left foreground; CTA upper left under copy',
  },
  {
    id: 'cunning', name: 'ドヤカンニング', category: 'Sales enablement / meeting copilot', colors: ['#EC4899', '#0F172A'],
    headline: ['想定外の質問にも、', '言葉に詰まらない。'],
    support: ['Web会議の質問を検出し、回答案を即時提示。', '登録資料を根拠に、要点と話す内容を表示。'],
    features: ['根拠資料を登録', '会話から質問を検出', '要点と根拠を同時に'],
    summary: 'Web会議の発言から質問を検出し、登録済み資料に基づく要点・話すスクリプト・根拠をリアルタイム表示するAIカンペ。',
    target: '商談・面接・顧客対応を行う担当者', problem: '想定外の質問に即答できず、応対品質が担当者ごとにばらつく。', benefit: '登録資料を根拠にした回答案を会話中に提示する。',
    mascot: ['ヘッドセット', '小さなカンペパネル'], pose: 'ヘッドセットを着け、片耳で会議を聞きながら小さなカンペパネルを示す', expression: 'attentive and reassuring', mainScreen: '回答支援画面', layout: 'large product UI as soft background right 66%; copy left; mascot right edge listening; CTA left bottom',
  },
  {
    id: 'sfa', name: 'ドヤ営業管理', category: 'Sales Tech / SFA', colors: ['#F97316', '#0F172A'],
    headline: ['営業管理を、', 'シンプルに。'],
    support: ['取引先・商談・タスク・売上を一元管理。', '設定不要でその日から使える、かんたんSFA。'],
    features: ['商談をカンバン管理', '取引先を一元管理', '売上ダッシュボード'],
    summary: '取引先、商談パイプライン、タスク、売上ダッシュボードに絞り、設定不要で始められる中小チーム向けSFA。',
    target: 'Excel管理から移行したい中小営業チーム', problem: '重いSFAは定着せず、Excelでは商談状況が共有しにくい。', benefit: '必要な営業管理機能だけを、設定不要の一画面にまとめる。',
    mascot: ['商談ボード', 'オレンジの進捗カード'], pose: '商談ボード上のカードを受注列へ移動している', expression: 'confident and upbeat', mainScreen: '商談パイプライン画面', layout: 'headline top left; wide product UI across bottom 68%; mascot upper right moving a card; CTA left middle',
  },
  {
    id: 'shodan', name: 'ドヤ商談準備', category: 'Sales research', colors: ['#0D9488', '#0F172A'],
    headline: ['商談準備を、', 'URL1本で。'],
    support: ['URLから企業リサーチと課題仮説を自動生成。', '解決策・提案資料まで一気通貫。'],
    features: ['URLで深掘り調査', '課題仮説をAIが立案', '提案資料を一括生成'],
    summary: '商談先URLから公開情報を調査し、現状分析、課題仮説、解決策、提案資料までを生成する商談準備サービス。',
    target: '法人営業・提案担当者', problem: 'アポ前の企業調査と提案資料づくりに毎回時間がかかる。', benefit: 'URL一本から調査・仮説・解決策・提案資料まで一気通貫で作る。',
    mascot: ['ノートPC', '企業分析レポート'], pose: 'ノートPCで企業サイトを分析し、片手で企業分析レポートを確認する', expression: 'analytical and ready', mainScreen: '企業調査画面', layout: 'copy left 36%; stacked UI panels right; mascot seated between panels and copy; CTA left bottom',
  },
  {
    id: 'aio', name: 'ドヤAIO', category: 'AEO / AI visibility analytics', colors: ['#8B5CF6', '#0F172A'],
    headline: ['そのブランド、', 'AIは推してる？'],
    support: ['4つのAIで言及・引用・順位を測定。', 'URLから競合とのAI可視性を比較。'],
    features: ['4つのAIで言及率測定', '競合とSoVを比較', '引用元ドメインを把握'],
    summary: 'ChatGPT・Gemini・Claude・Perplexityでのブランド言及、引用、順位、Share of Voiceを測定するAI可視性サービス。',
    target: 'ブランド・広報・SEO/AEO担当者', problem: 'AI検索上で自社が言及・引用されているか、競合と比較できない。', benefit: '4つのAIでの言及率・SoV・引用元を可視化し、改善行動につなげる。',
    mascot: ['検索結果カード', '分析グラフ'], pose: '複数の検索結果カードと分析グラフを見比べ、虫眼鏡で引用元を確認する', expression: 'curious and analytical', mainScreen: 'AI可視性ランキング画面', layout: 'headline top center-left; two UI cards split across lower half; mascot lower left analyzing; CTA upper left', cta: '無料で診断する',
  },
  {
    id: 'adimage', name: 'ドヤ広告画像AI', category: 'Creative automation / MarTech', colors: ['#FB7185', '#0F172A'],
    headline: ['URLを貼るだけで、', '入稿できる広告画像。'],
    support: ['URLから媒体別の広告画像を一括生成。', '文字検査・採点・改善・ZIP出力まで。'],
    features: ['媒体別の実寸出力', '文字を自動検査', 'AIで採点・改善'],
    summary: 'サービスURLからブランド情報とコピーを読み取り、媒体別比率の広告画像を生成し、文字検査・採点・改善・ZIP出力まで行うサービス。',
    target: '広告クリエイティブを継続運用するマーケター', problem: '媒体別サイズの作り分けと文字確認、改善作業が重い。', benefit: '媒体ごとの入稿サイズを一括生成し、検査・採点・改善まで自動化する。',
    mascot: ['デザインボード', 'カラースウォッチ'], pose: 'デザインボード上で広告クリエイティブを編集し、カラースウォッチを選ぶ', expression: 'creative and focused', mainScreen: '媒体別サイズ生成画面', layout: 'copy left; product UI grid right 60%; mascot lower right operating design board; CTA left bottom',
  },
  {
    id: 'interview', name: 'ドヤインタビュー', category: 'Content / transcription', colors: ['#3B82F6', '#0F172A'],
    headline: ['取材の録音から、', '記事の形まで。'],
    support: ['音声を話者ごとに文字起こし。', '媒体に合う記事ドラフトまで自動生成。'],
    features: ['録音をそのまま入れる', '話者ごとに文字へ', '媒体に合う記事へ'],
    summary: '音声や動画をアップロードし、話者分離付き文字起こしから構成・記事ドラフトまで作るインタビュー記事生成サービス。',
    target: '取材記事を制作する編集者・広報・マーケター', problem: '取材後の文字起こし・構成・記事化に数日かかる。', benefit: '録音から話者別文字起こし、媒体に合う記事ドラフトまで進める。',
    mascot: ['インタビューマイク', 'トランスクリプトカード'], pose: 'インタビューマイクを持ち、もう一方の手で話者別トランスクリプトを確認する', expression: 'engaged and personable', mainScreen: '話者別文字起こし画面', layout: 'product UI left 56%; copy right; mascot lower center holding microphone toward UI; CTA right bottom',
  },
  {
    id: 'persona', name: 'ドヤペルソナAI', category: 'Marketing strategy', colors: ['#9333EA', '#0F172A'],
    headline: ['「誰に向けて作るか」を、', '30秒で1枚に。'],
    support: ['商材と業界から顧客像を1枚に整理。', '訴求・導線・検証項目まで施策に変換。'],
    features: ['商材の条件を入力', '顧客像を1枚に', '施策の指示へ変換'],
    summary: '商材と業界から年齢・職種・課題・情報源・判断軸を含むペルソナを生成し、訴求や導線の指示へ変換するサービス。',
    target: 'LP・広告・コンテンツを設計するマーケティングチーム', problem: 'ターゲット像が担当者の勘に依存し、制作指示が揃わない。', benefit: '顧客像を一枚に整理し、コピーや導線の判断材料に変換する。',
    mascot: ['顧客プロフィールカード', '付箋'], pose: '複数の顧客プロフィールカードを比較し、重要な属性に付箋を貼る', expression: 'thoughtful and insightful', mainScreen: 'ペルソナシート画面', layout: 'copy left 38%; tall profile UI right 55%; mascot between copy and profile cards; CTA left bottom',
  },
  {
    id: 'mensetsu', name: 'ドヤ面接官', category: 'HR Tech / AI interview', colors: ['#F97316', '#0F172A'],
    headline: ['一次面接の日程調整を、', 'まるごと無くす。'],
    support: ['AIが一次面接を実施し、根拠付きで評価。', '応募者はURLを開くだけ。最終判断は人が行う。'],
    features: ['日程を合わせなくていい', '全員に同じ基準で', 'NG質問を自動ブロック'],
    summary: 'AIが構造化された一次面接を音声で実施し、評価軸ごとのスコアと根拠引用を残す採用支援サービス。最終判断は人が行う。',
    target: '一次面接の母数と評価品質を両立したい採用担当者', problem: '日程調整が重く、面接官ごとに質問と評価がばらつく。', benefit: '応募者がURLから受けられる一次面接と、同じ評価軸の根拠付きレポートを提供する。',
    mascot: ['タブレット', '面接評価シート'], pose: '面接官風のネイビージャケットを白いパーカーの上に着て、タブレットの評価シートを確認する', expression: 'fair, calm and professional', mainScreen: '面接進行画面', layout: 'headline top left; product UI right 56%; mascot lower left in interviewer pose; CTA left middle',
  },
  {
    id: 'quote', name: 'ドヤ見積もりAI', category: 'Sales operations / quotation', colors: ['#16A34A', '#0F172A'],
    headline: ['「概算いくら？」に、', 'その場で紙を出す。'],
    support: ['URLから相場つきの見積もり品目を提案。', '商談中に編集し、その場でPDF出力。'],
    features: ['金額の出所を表示', '複数税率を正確に計算', '見積書PDFを即時出力'],
    summary: 'サービスURLから商材と課金軸を解析し、出所を示した相場つき品目を提案。商談中に編集して日本語PDFを出力する見積もりサービス。',
    target: '商談中に概算提示と見積書作成を行う営業担当者', problem: '概算の根拠確認と見積書作成に時間がかかり、担当者ごとに金額感がばらつく。', benefit: '金額の出所を表示しながら品目・単価を編集し、その場でPDF化する。',
    mascot: ['電卓', '見積書'], pose: '電卓で金額を確認しながら、完成した見積書を相手に差し出す', expression: 'precise and reassuring', mainScreen: '見積書編集画面', layout: 'copy left; product UI right 58%; mascot lower center holding quote toward viewer; CTA left bottom',
  },
]

const sharedTypography = {
  headline_font: 'Japanese Gothic ExtraBold', body_font: 'Japanese Gothic Regular', horizontal_scale: '100%',
  prohibit_condensed_text: true, prohibit_stretched_text: true, max_headline_lines: 2, max_body_lines: 2,
  prefer_line_break_over_compression: true,
}

const sharedStyle = {
  keywords: ['BtoB SaaS', 'clean', 'professional', 'modern', 'product-led', 'Japanese SaaS', 'minimal'],
  avoid: ['game advertising', 'fantasy', 'excessive neon', 'AI template', 'Canva template', 'mascot dominated composition'],
}

await fs.mkdir(SPECS, { recursive: true })
await fs.mkdir(path.join(ROOT, 'mascots'), { recursive: true })
await fs.mkdir(path.join(ROOT, 'images'), { recursive: true })
await fs.mkdir(path.join(ROOT, 'qa'), { recursive: true })

const index = []
for (const s of services) {
  const officialUrl = `https://doya-ai.surisuta.jp/${s.id}`
  const spec = {
    service: { name: s.name, official_url: officialUrl, category: s.category, primary_color: s.colors[0], secondary_color: s.colors[1] },
    research: {
      checked_at: '2026-08-24T00:00:00+09:00',
      service_summary: s.summary, target_user: s.target, main_problem: s.problem, main_benefit: s.benefit,
      confirmed_features: s.features,
      confirmed_ui_elements: s.features,
      official_logo_reference: `public/${s.id}/logo.png`,
      official_screenshot_reference: `public/${s.id}/hero.webp`,
      sources: [officialUrl, `src/app/${s.id}`, `src/lib/services.ts`],
    },
    banner: { ...common, headline: s.headline, support_copy: s.support, feature_chips: s.features, cta: s.cta || common.cta },
    layout: {
      composition: s.layout,
      headline_position: s.layout.split(';')[0],
      product_ui_position: s.layout.split(';')[1] || 'right',
      mascot_position: s.layout.split(';')[2] || 'secondary',
      cta_position: s.layout.split(';')[3] || 'lower left',
      white_space: 'generous',
    },
    mascot: { use: true, pose: s.pose, props: s.mascot, expression: s.expression, size: 'secondary visual' },
    product_ui: { use_real_product_reference: true, main_screen: s.mainScreen, important_components: s.features, do_not_invent_features: true },
    typography: sharedTypography,
    visual_style: sharedStyle,
  }
  await fs.writeFile(path.join(SPECS, `${s.id}.json`), `${JSON.stringify(spec, null, 2)}\n`)
  index.push({ id: s.id, name: s.name, spec: `specs/${s.id}.json`, official_url: officialUrl, screenshot: `public/${s.id}/hero.webp`, logo: `public/${s.id}/logo.png` })
}

await fs.writeFile(path.join(ROOT, 'manifest.json'), `${JSON.stringify({ created_at: '2026-08-24T00:00:00+09:00', count: index.length, mode: 'built-in image generation for mascot plus deterministic composition of official logo, real UI and Japanese typography', items: index }, null, 2)}\n`)

const promptHeader = `# ドヤマーケAI 15サービス広告バナー プロンプトセット

生成モード: Codex内蔵画像生成（1サービスにつき1回、サービス別マスコットを生成）

## 共通プロンプト

Use case: ads-marketing
Asset type: secondary mascot cutout for a 16:9 Japanese BtoB SaaS advertisement
Subject invariants: exact same official Doya Marke AI white bear mascot from the official references; rounded white bear; futuristic cyan-blue visor goggles; white hoodie; clear blue "</>" code symbol centered on hoodie; same face, proportions, crisp navy/cyan outline language.
Style/medium: polished 2D professional Japanese BtoB SaaS brand illustration, friendly but not childish.
Background: genuinely transparent, no checkerboard pattern, no backdrop. Single isolated full-body character, generous transparent padding, no crop.
Text constraints: no words, no Japanese text, no letters except the exact "</>" hoodie symbol; props use abstract shapes only.
Avoid: game advertising, fantasy, magic, excessive neon, 3D toy, preschool style, extra characters, extra limbs, watermark.

最終バナーでは、生成マスコットだけを使用し、公式ロゴ・公式公開UI・JSON内の日本語コピーを決定論的に合成する。日本語と公式UIは画像生成AIで描き直さない。
`
const promptDetails = services.map((s) => `\n## ${s.name} (${s.id})\n\n- Pose: ${s.pose}\n- Props: ${s.mascot.join(' / ')}\n- Expression: ${s.expression}\n- Headline: ${s.headline.join(' / ')}\n- Official UI: public/${s.id}/hero.webp\n- Official logo: public/${s.id}/logo.png\n`).join('')
await fs.writeFile(path.join(ROOT, 'prompts.md'), `${promptHeader}${promptDetails}`)

console.log(`Wrote ${index.length} banner specs to ${SPECS}`)
