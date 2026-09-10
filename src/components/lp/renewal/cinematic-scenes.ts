export type CinematicScene = {
  title: [string, string];
  lead: [string, string];
  category: string;
  demoTitle: [string, string];
  demoLead: string;
  image: string;
};

const artwork = (id: string) => `/renewal/cinematic/${id}-20260910-v1.webp`;

export const CINEMATIC_SCENES: Record<string, CinematicScene> = {
  banner: {
    title: ["そのアイデアを、", "目を引くバナーに。"],
    lead: [
      "つくりたい想いに、AIの表現力を。",
      "業種を選ぶだけで、訴求の異なる3案を提案。選んで、比べて、あなたの広告へ。",
    ],
    category: "CREATIVE STUDIO",
    demoTitle: ["つくる時間まで、", "軽やかに。"],
    demoLead:
      "テンプレートを選んで、AIが3案を提案。気に入ったバナーを書き出すまでの流れをご覧ください。",
    image: "/renewal/banner-atelier-20260910-v1.webp",
  },
  seo: {
    title: ["その知見を、", "読まれる記事に。"],
    lead: [
      "伝えたいことに、筋の通った構成を。",
      "検索意図の整理から構成・執筆・公開前の確認まで。記事づくりを、ひとつの流れに。",
    ],
    category: "EDITORIAL STUDIO",
    demoTitle: ["考えるところから、", "記事の仕上げまで。"],
    demoLead:
      "キーワードや読者の条件を入力し、構成を確認。公開前のチェックまで、実際の操作の流れを紹介します。",
    image: artwork("seo"),
  },
  interview: {
    title: ["語られた想いを、", "伝わる物語に。"],
    lead: [
      "会話の中にある、その人だけの言葉を。",
      "録音した音声から文字起こし、内容の整理、記事作成へ。インタビューの価値を、読めるかたちに。",
    ],
    category: "INTERVIEW STUDIO",
    demoTitle: ["音声を預けて、", "言葉を磨く。"],
    demoLead:
      "音声のアップロードから文字起こしの確認、記事の仕上がりまで。3つの画面で使い方を紹介します。",
    image: artwork("interview"),
  },
  persona: {
    title: ["届けたい人を、", "もっと鮮明に。"],
    lead: [
      "顧客の理解が、次の打ち手を変える。",
      "商材の情報から顧客像を整理。悩みや行動を捉え、施策を考えるためのペルソナをつくります。",
    ],
    category: "CUSTOMER INSIGHT",
    demoTitle: ["商材の情報を、", "顧客理解の入口に。"],
    demoLead:
      "商材の条件を入力し、顧客プロフィールと施策の要点を確認。仮説を具体化する流れをご覧ください。",
    image: artwork("persona"),
  },
  hr: {
    title: ["一人ひとりの力を、", "組織の可能性に。"],
    lead: [
      "人を知り、チームの全体像を捉える。",
      "従業員情報・組織図・人事評価をひとつに。人と組織に向き合うための情報を、見やすく整えます。",
    ],
    category: "PEOPLE & ORGANIZATION",
    demoTitle: ["人の情報から、", "組織の全体像へ。"],
    demoLead:
      "従業員を選び、組織図を見て、人事評価を確認。日々の人事業務で使う画面を紹介します。",
    image: artwork("hr"),
  },
  kintai: {
    title: ["日々の時間を、", "働くゆとりへ。"],
    lead: [
      "出勤の記録から、月々の確認まで。",
      "打刻・勤怠集計・申請をまとめて管理。毎日の記録を整え、働く時間を見通しやすくします。",
    ],
    category: "TIME & ATTENDANCE",
    demoTitle: ["いつもの打刻を、", "確かな記録に。"],
    demoLead:
      "出勤の打刻、月の勤怠集計、申請の確認まで。担当者と働く人をつなぐ操作の流れをご覧ください。",
    image: artwork("kintai"),
  },
  doyalist: {
    title: ["次の出会いを、", "事業の一歩に。"],
    lead: [
      "届けるべき企業を、見つけるところから。",
      "条件に合う企業を探し、営業リストと文面を整理。新しい接点をつくる準備を支えます。",
    ],
    category: "BUSINESS DISCOVERY",
    demoTitle: ["企業を探して、", "次の接点を考える。"],
    demoLead:
      "検索条件の指定から企業リストの確認、営業文面の作成まで。営業準備の流れを紹介します。",
    image: artwork("doyalist"),
  },
  promane: {
    title: ["チームの仕事を、", "ひとつの流れに。"],
    lead: [
      "進め方も、収支も、見渡せる。",
      "案件・タスク・プロジェクトの収支をまとめて管理。いまの状況と次の一手を、チームで共有できます。",
    ],
    category: "PROJECT MANAGEMENT",
    demoTitle: ["案件を整え、", "進み具合を見渡す。"],
    demoLead:
      "案件を入力し、タスクを整理、収支を確認。プロジェクトの全体像を捉える3つの画面です。",
    image: artwork("promane"),
  },
  doyaslide: {
    title: ["その考えを、", "伝わる資料に。"],
    lead: [
      "伝えたいことに、構成と表現を。",
      "テーマの入力から構成づくり、スライドの生成まで。提案や説明のたたき台を、かたちにします。",
    ],
    category: "PRESENTATION STUDIO",
    demoTitle: ["テーマひとつから、", "資料の全体像へ。"],
    demoLead:
      "資料のテーマを入力し、構成を確認、スライドを見る。アイデアが資料になる過程を紹介します。",
    image: artwork("doyaslide"),
  },
  cunning: {
    title: ["大切な対話に、", "頼れる知識を。"],
    lead: [
      "答えを探す時間を、対話の時間に。",
      "登録した資料をもとに、会話中の質問への回答をサポート。根拠を確かめながら、話を進められます。",
    ],
    category: "KNOWLEDGE ASSISTANT",
    demoTitle: ["知識を備えて、", "その場の質問に。"],
    demoLead:
      "資料の登録、会話からの質問検出、回答と根拠の確認まで。対話を支える操作イメージです。",
    image: artwork("cunning"),
  },
  sfa: {
    title: ["ひとつの商談を、", "次のチャンスへ。"],
    lead: [
      "顧客との関係も、営業の進み具合も。",
      "商談・顧客情報・営業状況をひとつに整理。チームで状況を共有し、次のアクションを考えられます。",
    ],
    category: "SALES MANAGEMENT",
    demoTitle: ["商談の現在地を、", "チームで見渡す。"],
    demoLead:
      "商談を選び、顧客情報を見て、営業状況を確認。日々の営業管理を3つの画面で紹介します。",
    image: artwork("sfa"),
  },
  shodan: {
    title: ["会う前の準備で、", "対話は変わる。"],
    lead: [
      "相手を知り、提案の筋道をつくる。",
      "企業情報のリサーチから課題仮説、提案資料まで。商談前に考えるべきことを、ひとつずつ整えます。",
    ],
    category: "MEETING INTELLIGENCE",
    demoTitle: ["企業を知り、", "提案の入口を探す。"],
    demoLead:
      "企業情報を確認し、課題仮説を整理、提案資料へ。商談準備の流れを実際の画面構成で紹介します。",
    image: artwork("shodan"),
  },
  aio: {
    title: ["AIにどう映るか、", "見える戦略へ。"],
    lead: [
      "新しい検索での、ブランドの現在地を。",
      "AIごとの言及状況や競合との比較、引用元を確認。AIからの見られ方を、改善の手がかりにします。",
    ],
    category: "AI SEARCH INSIGHT",
    demoTitle: ["AIの回答から、", "ブランドを見つめる。"],
    demoLead:
      "AI別の状況、競合とのシェア比較、引用元の確認まで。可視性を捉える画面を紹介します。",
    image: artwork("aio"),
  },
  mensetsu: {
    title: ["一人ひとりに、", "向き合う面接を。"],
    lead: [
      "対話の内容を、採用の判断材料に。",
      "AIによる面接の進行から評価の確認まで。質問の基準と記録を見ながら、人が判断する採用を支えます。",
    ],
    category: "INTERVIEW ASSISTANT",
    demoTitle: ["対話の記録を、", "判断の材料に。"],
    demoLead:
      "面接の進行、評価の確認、質問基準の確認まで。AIを使った面接の流れをご覧ください。",
    image: artwork("mensetsu"),
  },
  quote: {
    title: ["仕事の価値を、", "伝わる見積に。"],
    lead: [
      "明細を整え、金額を確かめ、届ける。",
      "サービス情報から見積のたたき台を作成。品目・税・値引きを確認し、PDFに仕上げられます。",
    ],
    category: "QUOTATION STUDIO",
    demoTitle: ["明細の確認から、", "見積書の仕上げへ。"],
    demoLead:
      "見積明細を確認し、税や値引きを調整、PDFを書き出す。見積づくりの操作を紹介します。",
    image: artwork("quote"),
  },
  aishodan: {
    title: ["いつもの対話を、", "商談の一歩へ。"],
    lead: [
      "聞くべきことを、会話の中で。",
      "AIが商談のヒアリングを進め、内容を整理。聞き取った情報と結果を、次のアクションにつなげます。",
    ],
    category: "AI CONVERSATION",
    demoTitle: ["対話を進めて、", "必要な情報を整える。"],
    demoLead:
      "AIとの商談、ヒアリング内容の整理、商談結果の確認まで。会話から情報がまとまる流れです。",
    image: artwork("aishodan"),
  },
  adimage: {
    title: ["届けたい価値を、", "目を引く一枚に。"],
    lead: [
      "表現の選択肢を、もっと豊かに。",
      "媒体に合わせた広告画像をつくり、文字や改善点を確認。クリエイティブを磨く作業を支えます。",
    ],
    category: "AD CREATIVE STUDIO",
    demoTitle: ["画像をつくって、", "表現を磨いていく。"],
    demoLead:
      "媒体別の画像を見て、文字を確認し、改善へ。広告画像を検討する3つの画面を紹介します。",
    image: artwork("adimage"),
  },
};
