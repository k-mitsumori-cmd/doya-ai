// 5つの製品（セールス・マーケティング・人事・予実管理・経営管理）の LP の中身（2026-11-02）。
// 設計の正本: docs/design/buddy-products-2026-11-01.md（製品とツールの対応は §2.1）。
// ツールの名前と説明は src/lib/services.ts の description を、短い平らな文にしたもの。確かめられない数字は書かない。
// 画面の見せ方（色・絵）はここに持たず、ProductLp.tsx と renewal-lp-products.css 側で差し替える。

export type ProductId = "sales" | "marketing" | "hr" | "budget" | "management";

export type ProductTool = {
  /** /<id> のツールの URL。href があればそちらを使う */
  id: string;
  href?: string;
  name: string;
  desc: string;
  soon?: boolean;
  /** 別の製品にも入っているツール */
  shared?: string;
};

export type Product = {
  id: ProductId;
  /** 製品名（例: セールス）。正式名は「ドヤバディ セールス」 */
  name: string;
  /** 誰が使うか */
  who: string;
  /** ファーストビューの見出し（2行。\n で改行） */
  title: string;
  sub: string;
  /** ファーストビューの絵（1536x1024 を想定）と、読み上げ用の説明 */
  image: string;
  imageAlt: string;
  pains: { title: string; desc: string }[];
  toolsHead: string;
  toolsLead: string;
  tools: ProductTool[];
  /** スクロールで進む操作画面の例 */
  story: { goal: string; plan: { tool: string; text: string }[] };
  /** 製品の一覧に出す一言 */
  oneLine: string;
};

export const PRODUCT_ORDER: ProductId[] = ["sales", "marketing", "hr", "budget", "management"];

export const PRODUCTS: Record<ProductId, Product> = {
  sales: {
    id: "sales",
    name: "セールス",
    who: "営業の担当者",
    title: "商談の準備は、\nドヤバディに書いて任せる",
    sub: "営業リストの作成、商談先の調べもの、提案資料、見積もりまで。やりたいことを書くと、ドヤバディが必要なツールを順に動かします。",
    image: "/renewal-lp/products/sales.webp",
    imageAlt: "小さな打ち合わせコーナーで、名刺の束と提案書を持って立つドヤくん",
    pains: [
      { title: "商談の準備に時間がかかる", desc: "相手の会社を調べて、資料を作って、聞くことをまとめる。1件ずつやると、提案そのものに使う時間が残りません。" },
      { title: "声をかける会社を決めるのが大変", desc: "リストを作るだけで1日が終わり、連絡そのものが後回しになります。" },
      { title: "商談と見積もりの記録が散らばる", desc: "取引先、商談、タスクが別々の場所にあり、次に何をするかが担当者の頭の中にしかありません。" },
    ],
    toolsHead: "セールスで使えるツール",
    toolsLead: "どれも、URL や会社名を入れるところから始められます。",
    tools: [
      { id: "sfa", name: "営業管理", desc: "取引先・商談・タスクを一元管理します。シンプルで安いかんたんSFAです。" },
      { id: "shodan", name: "商談準備", desc: "商談先のURLから企業調査をします。プロプランなら課題仮説と提案資料も作ります。" },
      { id: "aishodan", name: "AI商談", desc: "AIが一次商談を代行します。発行したURLを開いてもらうだけで、24時間いつでも商談が始まります。" },
      { id: "doyalist", name: "リスト", desc: "AIで営業リストを作り、営業の文面も作ります。" },
      { id: "doyaslide", name: "スライド", desc: "AIが全スライドを画像で作ります。" },
      { id: "quote", name: "見積もり", desc: "サービスURLを入れるだけで、相場つきの見積もり品目が並びます。商談中に編集して、その場でPDFにできます。", shared: "予実管理にも入っています" },
    ],
    story: {
      goal: "来週の商談5件の準備を進めたい",
      plan: [
        { tool: "営業管理", text: "5件の取引先と日程を整理する" },
        { tool: "商談準備", text: "相手の会社を調べて課題を仮説にする" },
        { tool: "スライド", text: "提案の資料を作る" },
        { tool: "見積もり", text: "見積もりの品目をそろえる" },
      ],
    },
    oneLine: "リスト、商談の準備、提案資料、見積もり",
  },
  marketing: {
    id: "marketing",
    name: "マーケティング",
    who: "マーケティングの担当者",
    title: "記事もバナーも、\nドヤバディに書いて任せる",
    sub: "記事、バナー、広告画像、AI検索への対策まで。やりたい施策を書くと、ドヤバディが必要なツールを選んで進めます。",
    image: "/renewal-lp/products/marketing.webp",
    imageAlt: "バナーや記事の下書きが貼られたボードの前で、バナーを掲げるドヤくん",
    pains: [
      { title: "やりたい施策に、手が回らない", desc: "記事も広告もバナーも必要なのに、作る人が足りず、後回しのまま月が終わります。" },
      { title: "ツールごとに使い方を覚えるのが大変", desc: "記事、画像、広告、分析で別のツールを使うと、切り替えるたびに操作を思い出す必要があります。" },
      { title: "AIの検索で、自社がどう答えられているか分からない", desc: "ChatGPT などで自社の名前が出るかを、誰も測れていません。" },
    ],
    toolsHead: "マーケティングで使えるツール",
    toolsLead: "記事から画像、AI検索の対策まで、同じ画面から呼び出せます。",
    tools: [
      { id: "seo", name: "記事作成", desc: "SEOとLLMOに強い長文記事を、安定して作ります。" },
      { id: "banner", name: "バナー", desc: "プロ品質のバナーを自動で作ります。" },
      { id: "adimage", name: "広告画像", desc: "URLを貼るだけで、媒体・配置ごとにサイズのそろった広告画像が出ます。文字は画像に入っていて、そのまま入稿できます。" },
      { id: "aio", name: "AIO", desc: "ChatGPT・Gemini・Claude・Perplexity での、ブランドのAI可視性を測って比べます。" },
      { id: "persona", name: "ペルソナ", desc: "ターゲットのペルソナをAIで作ります。" },
      { id: "interview", name: "インタビュー", desc: "インタビューの音声から、記事を自動で作ります。" },
      { id: "asklink", name: "AI質問リンク", desc: "サイトのURLを入れるだけで、ChatGPT に質問が届く「AIに聞く」リンクとポップアップ用バナーができます。" },
      { id: "popup", name: "ポップアップ", desc: "サイトのURLを入れるとAIがポップアップを提案します。タグを1行貼れば表示され、クリック率まで測れます。" },
      { id: "tenjikai", name: "展示会", desc: "ブース設営案、制作物、予算、締切の管理までを一括で準備します。", soon: true },
    ],
    story: {
      goal: "今月の記事を3本と、告知のバナーを進めたい",
      plan: [
        { tool: "ペルソナ", text: "読んでほしい人の像を決める" },
        { tool: "記事作成", text: "3本の構成と下書きを作る" },
        { tool: "バナー", text: "告知のバナーを作る" },
        { tool: "AIO", text: "AI検索での見え方を測る" },
      ],
    },
    oneLine: "記事、バナー、広告画像、AI検索の対策",
  },
  hr: {
    id: "hr",
    name: "人事",
    who: "人事・総務の担当者",
    title: "採用から勤怠まで、\nドヤバディに書いて任せる",
    sub: "面接の準備、社内の声の記事づくり、勤怠の管理まで。やりたいことを書くと、ドヤバディが必要なツールを順に動かします。",
    image: "/renewal-lp/products/hr.webp",
    imageAlt: "面接室で、評価シートのクリップボードを持って立つドヤくん",
    pains: [
      { title: "一次面接に、面接官の時間が取られる", desc: "面接官の時間が足りず、応募者を待たせたり、面接官ごとに評価の基準がそろわなかったりします。" },
      { title: "人の情報が散らばっている", desc: "社員の情報、評価、面談の記録が別々のファイルにあり、探すだけで時間がかかります。" },
      { title: "社内の魅力を発信する時間がない", desc: "採用や社内向けに記事を作りたくても、取材と執筆に手が回りません。" },
    ],
    toolsHead: "人事で使えるツール",
    toolsLead: "採用、人材管理、勤怠を、同じ画面から呼び出せます。",
    tools: [
      { id: "hr", name: "HR", desc: "中小企業のためのタレントマネジメントです。" },
      { id: "mensetsu", name: "面接官", desc: "AIアバターが一次面接を行い、評価レポートまで残します。応募者はブラウザだけで受けられます。" },
      { id: "kintai", name: "勤怠", desc: "シンプルで使いやすい、クラウドの勤怠管理です。" },
      { id: "shanai", name: "社内インタビュー", desc: "録音か社員アンケートと写真から、会社の魅力が伝わる社員インタビュー記事とサムネイルを作ります。", soon: true },
    ],
    story: {
      goal: "今月の面接の質問と評価の表をそろえたい",
      plan: [
        { tool: "HR", text: "募集の内容と求める人の像を整理する" },
        { tool: "面接官", text: "一次面接の質問と評価の観点を作る" },
        { tool: "面接官", text: "面接の結果を評価レポートにまとめる" },
        { tool: "勤怠", text: "入社予定の人の勤務設定を用意する" },
      ],
    },
    oneLine: "採用の面接、人材管理、勤怠",
  },
  budget: {
    id: "budget",
    name: "予実管理",
    who: "経理の担当者",
    title: "予定と実績の確認は、\nドヤバディに書いて任せる",
    sub: "売上の予定と入金、支払いの予定と出金を、月ごとに並べて見ます。やりたいことを書くと、ドヤバディが必要なツールを動かします。",
    image: "/renewal-lp/products/budget.webp",
    imageAlt: "予定と実績の棒グラフが描かれたボードを指して、電卓を持つドヤくん",
    pains: [
      { title: "請求と入金の確認漏れが心配", desc: "請求書を出し忘れる、入金が済んだかを確かめ忘れる。月末に気づくと、取り戻すのが大変です。" },
      { title: "先の支払いが見えない", desc: "契約ごとの支払いがばらばらで、来月以降にいくら出ていくかをすぐに答えられません。" },
      { title: "予定と実績を、毎月手で並べている", desc: "表計算ソフトに数字を写して比べる作業に、毎月時間を取られています。" },
    ],
    toolsHead: "予実管理で使えるツール",
    toolsLead: "売上と支払いの予定と実績を、月ごとに並べて確かめられます。",
    tools: [
      { id: "income", name: "収入管理", desc: "契約を登録すると、毎月の売上予定が自動で作られます。請求書の発行から入金の確認まで、漏れに気づけます。", soon: true },
      { id: "expense", name: "支出管理", desc: "契約ごとに支払いを登録すると、毎月の出金と12か月先までの予定が分かります。", soon: true },
      { id: "quote", name: "見積もり", desc: "サービスURLを入れるだけで、相場つきの見積もり品目が並びます。", shared: "セールスにも入っています" },
      { id: "promane", name: "プロマネ", desc: "案件の進み具合、収支、人件費を一元管理します。", shared: "経営管理にも入っています" },
    ],
    story: {
      goal: "今月の請求書をまとめて出したい",
      plan: [
        { tool: "収入管理", text: "今月の売上予定を一覧にする" },
        { tool: "収入管理", text: "請求書の下書きを作る" },
        { tool: "支出管理", text: "今月と来月の支払い予定を並べる" },
        { tool: "プロマネ", text: "案件ごとの収支を確かめる" },
      ],
    },
    oneLine: "売上と支払いの、予定と実績の確認",
  },
  management: {
    id: "management",
    name: "経営管理",
    who: "社長・管理者",
    title: "会社全体の進み具合は、\nドヤバディに書いて任せる",
    sub: "全部の製品の動きを1枚で見て、判断が要ることを確かめます。やりたいことを書くと、ドヤバディが各製品のツールを順に動かします。",
    image: "/renewal-lp/products/management.webp",
    imageAlt: "朝の窓辺の長い机で、タブレットを持って壁の4枚のボードを示すドヤくん",
    pains: [
      { title: "会社の状況が、人に聞かないと分からない", desc: "営業、マーケ、人事、お金の状況がそれぞれの担当者の手元にあり、全体を見るには聞いて回る必要があります。" },
      { title: "ツールが増えるたびに、権限の管理が増える", desc: "誰がどのツールを使えるかを、ツールごとに設定し直すのは手間がかかります。" },
      { title: "進めた仕事を、あとから確かめられない", desc: "誰が何を進めたかが残っておらず、判断の根拠をたどれません。" },
    ],
    toolsHead: "経営管理で使えるもの",
    toolsLead: "全部の製品を見渡す入口と、会社の設定をまとめています。",
    tools: [
      { id: "home", href: "/home", name: "経営ホーム", desc: "ゴールと ToDo から、完成までの流れを見ます。全部の製品の動きを1か所で確かめられます。" },
      { id: "work", href: "/home/work", name: "ドヤくんが進めた仕事", desc: "ドヤくんが進めた仕事を一覧で見て、あとから確かめられます。" },
      { id: "promane", name: "プロマネ", desc: "案件の進み具合、収支、人件費を一元管理します。", shared: "予実管理にも入っています" },
      { id: "roles", href: "/home/roles", name: "会社とメンバーと権限", desc: "メンバーを招待し、役割を決めます。製品ごとの担当も、ここで決めます。" },
      { id: "power", href: "/home", name: "ドヤパワー", desc: "ドヤくんやツールが動いた量を、会社全体で確かめます。" },
    ],
    story: {
      goal: "来月の展示会で、商談を30件つくりたい",
      plan: [
        { tool: "マーケティング", text: "来場しそうな人の像を決めて、ブースの案を作る" },
        { tool: "セールス", text: "声をかける会社を絞って、商談の準備をする" },
        { tool: "予実管理", text: "出展の予算と、見込みの売上を並べる" },
        { tool: "経営管理", text: "判断が要ることを、まとめて確かめる" },
      ],
    },
    oneLine: "全部の製品の見渡しと、会社の設定",
  },
};

export const isProductId = (v: string): v is ProductId => (PRODUCT_ORDER as string[]).includes(v);
