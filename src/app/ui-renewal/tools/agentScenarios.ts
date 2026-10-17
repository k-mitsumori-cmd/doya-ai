// 経営エージェントの見本シナリオ。
// ⚠️ すべて見本。実際の生成・送信・DBの読み書きは行わない。社名・人名・数値は架空。
// 依頼文の言葉から1つ選び、計画 → 並列実行 → 承認 → まとめ、を再現する。

const T = '/ui-renewal/banner-templates/'

export type Preview =
  | { kind: 'images'; srcs: string[]; caption: string }
  | { kind: 'rows'; head: [string, string, string]; rows: [string, string, string][] }
  | { kind: 'stats'; items: { label: string; value: number; unit: string; decimals?: number }[] }
  | { kind: 'lines'; lines: string[] }
  | { kind: 'money'; label: string; value: number; note: string }

export interface AgentTask {
  id: string
  serviceId: string
  /** 何をするか（短く） */
  title: string
  /** 使うツール名（設計書のツールレジストリと同じ名前） */
  tool: string
  /** 同じ wave の作業は同時に走る */
  wave: number
  ms: number
  logs: string[]
  result: Preview
  /** 取りやめたとき、まとめから外す文に含まれる言葉 */
  summaryKey?: string
  /** 外に影響する操作。実行前に必ず人が承認する */
  approval?: { title: string; body: string; action: string }
}

export interface Scenario {
  id: string
  /** 依頼文にこの言葉が入っていたら選ぶ */
  words: string[]
  goal: string
  thinking: string[]
  tasks: AgentTask[]
  summary: { headline: string; points: string[]; impact: { label: string; value: number; unit: string; decimals?: number }[]; next: string[] }
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'growth',
    words: ['売上', '集客', '伸ば', '増や', '作戦', 'マーケ', '新規'],
    goal: '来月の売上を伸ばす作戦を立てて、準備まで進める',
    thinking: [
      '依頼を「売上を伸ばす」と理解しました',
      '営業管理の商談と、AI検索での見え方を先に確認します',
      '見込みの高い商談の後押しと、新しい見込み客づくりを同時に進めます',
      '外に出る操作（メール送信）は、実行前にあなたの承認をとります',
    ],
    tasks: [
      {
        id: 'deals',
        serviceId: 'sfa',
        title: '進行中の商談を洗い出す',
        tool: 'sfa.listDeals',
        wave: 0,
        ms: 2600,
        logs: ['商談42件を読み込み', '受注確度で並べ替え', '止まっている商談を7件発見'],
        result: {
          kind: 'rows',
          head: ['会社', '段階', '確度'],
          rows: [
            ['青葉ホールディングス', '見積', '80%'],
            ['北斗サービス', '交渉', '70%'],
            ['みらい工業', '提案', '60%'],
          ],
        },
      },
      {
        id: 'aio',
        serviceId: 'aio',
        title: 'AI検索での見え方を確認',
        tool: 'aio.visibilityReport',
        wave: 0,
        ms: 3000,
        logs: ['ChatGPT・Gemini・Claude・Perplexityに質問', '自社名の言及を集計', '競合との差を比較'],
        result: {
          kind: 'stats',
          items: [
            { label: '言及率', value: 63, unit: '%' },
            { label: '先月比', value: 8, unit: 'pt' },
            { label: '競合平均', value: 41, unit: '%' },
          ],
        },
      },
      {
        id: 'list',
        serviceId: 'doyalist',
        title: '新しい見込み客を30社リスト化',
        tool: 'doyalist.buildList',
        wave: 1,
        ms: 3200,
        logs: ['受注した会社に似た業種・規模を検索', '公開情報から30社を抽出', '見込み度で採点'],
        result: {
          kind: 'rows',
          head: ['会社', '地域', '見込み'],
          rows: [
            ['さくら商会', '東京', '94'],
            ['光洋製作所', '大阪', '91'],
            ['大和テック', '名古屋', '88'],
          ],
        },
      },
      {
        id: 'banner',
        serviceId: 'banner',
        title: 'キャンペーンのバナーを4案',
        tool: 'banner.generate',
        wave: 1,
        ms: 3600,
        logs: ['過去に反応の良かった見本を参照', '4案をデザイン', 'クリックされやすさで採点'],
        result: { kind: 'images', srcs: [`${T}it-saas-01.webp`, `${T}it-saas-04.webp`, `${T}it-saas-07.webp`, `${T}it-saas-02.webp`], caption: 'おすすめは1案目（予測92点）' },
      },
      {
        id: 'seo',
        serviceId: 'seo',
        title: '比較記事の構成をつくる',
        tool: 'seo.createOutline',
        wave: 1,
        ms: 2800,
        logs: ['AI検索で負けている質問を特定', '上位10記事を読み比べ', '見出しを組み立て'],
        result: { kind: 'lines', lines: ['結論：中小企業が選ぶべき3つの基準', '費用と導入期間の比較', '導入3社の事例', 'よくある質問'] },
      },
      {
        id: 'quote',
        serviceId: 'quote',
        title: '確度の高い2社の見積書を下書き',
        tool: 'quote.draftQuote',
        wave: 2,
        ms: 2400,
        logs: ['商談メモから品目を推定', '公開価格と相場で金額を設定', '2社分を下書き'],
        result: { kind: 'money', label: '見積合計（2社）', value: 1840000, note: '根拠のない金額は入れていません' },
      },
      {
        id: 'mail',
        serviceId: 'sfa',
        title: '止まっている商談にフォローの連絡',
        tool: 'sfa.draftFollowUp',
        wave: 2,
        ms: 2200,
        logs: ['7件の止まった理由を推定', '相手ごとに文面を下書き'],
        result: { kind: 'lines', lines: ['青葉ホールディングス様：見積の有効期限のご案内', '北斗サービス様：導入事例のご共有', 'ほか5件'] },
        summaryKey: 'フォローの連絡',
        approval: {
          title: '7社にフォローのメールを送ります',
          body: '文面はすべて下書き済みです。送信は、あなたの承認後に行います。',
          action: '承認して送る',
        },
      },
    ],
    summary: {
      headline: '来月の売上を伸ばす準備が整いました',
      points: [
        '見込みの高い3件を特定し、2社分の見積書を下書きしました',
        '止まっていた7件の商談に、フォローの連絡を送りました',
        '新しい見込み客を30社リストにしました',
        'AI検索で負けている質問に向けて、比較記事の構成をつくりました',
      ],
      impact: [
        { label: '見込み売上', value: 184, unit: '万円' },
        { label: '節約した時間', value: 11.5, unit: '時間', decimals: 1 },
        { label: 'できた成果物', value: 9, unit: '件' },
      ],
      next: ['来週の月曜、30社リストへの1通目を送る', '記事の本文を書き上げて公開する', '見積の返事が来たら、商談準備をまとめる'],
    },
  },
  {
    id: 'hire',
    words: ['採用', '人を', '募集', '面接', '求人', '雇'],
    goal: '営業を1人採用するための準備を一気に進める',
    thinking: [
      '依頼を「営業職の採用」と理解しました',
      'まず今のチームの人数と残業を確認して、必要な人物像を決めます',
      '求人の公開は外に出る操作なので、実行前にあなたの承認をとります',
    ],
    tasks: [
      {
        id: 'team',
        serviceId: 'hr',
        title: '営業チームの今を確認',
        tool: 'hr.listEmployees',
        wave: 0,
        ms: 2400,
        logs: ['営業部の8人を確認', 'スキルの偏りを集計', '足りない役割を特定'],
        result: { kind: 'lines', lines: ['営業部 8人（うち新人2人）', '大型案件の経験者が不足', '求める人物像：法人営業3年以上'] },
      },
      {
        id: 'overtime',
        serviceId: 'kintai',
        title: '営業部の残業を確認',
        tool: 'kintai.monthlyOvertime',
        wave: 0,
        ms: 2200,
        logs: ['今月の勤怠を集計', '部署別に比較'],
        result: {
          kind: 'stats',
          items: [
            { label: '平均残業', value: 32.5, unit: '時間', decimals: 1 },
            { label: '全社平均', value: 14.2, unit: '時間', decimals: 1 },
          ],
        },
      },
      {
        id: 'interview',
        serviceId: 'mensetsu',
        title: '一次面接の質問と評価基準',
        tool: 'mensetsu.createInterview',
        wave: 1,
        ms: 3000,
        logs: ['求める人物像から評価軸を5つ設定', '全員に同じ主質問を用意', '差別につながる質問を除外'],
        result: { kind: 'lines', lines: ['当社を志望した理由を教えてください', '大型案件で苦労した経験は？', '数字が伸びない時期の乗り越え方は？', 'ほか2問・評価軸5つ'] },
      },
      {
        id: 'jobbanner',
        serviceId: 'banner',
        title: '求人バナーを4案',
        tool: 'banner.generate',
        wave: 1,
        ms: 3400,
        logs: ['採用向けの見本を参照', '4案をデザイン'],
        result: { kind: 'images', srcs: [`${T}recruit-career-02.webp`, `${T}recruit-career-09.webp`, `${T}recruit-career-01.webp`, `${T}recruit-career-07.webp`], caption: 'おすすめは1案目' },
      },
      {
        id: 'publish',
        serviceId: 'mensetsu',
        title: '求人と面接URLを公開',
        tool: 'mensetsu.publishOpening',
        wave: 2,
        ms: 1800,
        logs: ['公開用のページを用意', '応募者向けの面接URLを発行'],
        result: { kind: 'lines', lines: ['求人ページ：準備完了', '面接URL：応募者ごとに1回だけ使えるURL'] },
        summaryKey: '面接の受付',
        approval: {
          title: '求人を公開し、面接の受付を始めます',
          body: '公開すると、社外の人が見られるようになります。内容を確認してから承認してください。',
          action: '承認して公開',
        },
      },
    ],
    summary: {
      headline: '営業1人の採用を始める準備が整いました',
      points: ['営業部は残業が全社平均の2倍以上で、大型案件の経験者が足りません', '一次面接の質問と評価基準をつくりました', '求人バナー4案と求人ページを用意し、面接の受付を始めました'],
      impact: [
        { label: '節約した時間', value: 6.5, unit: '時間', decimals: 1 },
        { label: 'できた成果物', value: 7, unit: '件' },
      ],
      next: ['応募が来たら、AI面接の結果を毎朝まとめて報告', '内定が出たら、HRに社員として登録する'],
    },
  },
  {
    id: 'close',
    words: ['締め', '月末', '月次', '経理', '残業', '集計', 'まとめ', '報告'],
    goal: '今月の締めに必要な数字をまとめて、承認待ちを片付ける',
    thinking: ['依頼を「月末の締め」と理解しました', '勤怠・案件の収支・商談の見込みを同時に集計します', '承認待ちの申請は、あなたの確認後に処理します'],
    tasks: [
      {
        id: 'kintai',
        serviceId: 'kintai',
        title: '今月の勤怠を集計',
        tool: 'kintai.monthlySummary',
        wave: 0,
        ms: 2600,
        logs: ['48人分の打刻を集計', '残業45時間超の人を確認'],
        result: {
          kind: 'stats',
          items: [
            { label: '総労働', value: 7640, unit: '時間' },
            { label: '残業45h超', value: 2, unit: '人' },
          ],
        },
      },
      {
        id: 'pnl',
        serviceId: 'promane',
        title: '案件ごとの収支を計算',
        tool: 'promane.projectPnL',
        wave: 0,
        ms: 3000,
        logs: ['12案件の工数を集計', '人件費を自動計算', '赤字の案件を特定'],
        result: {
          kind: 'rows',
          head: ['案件', '売上', '利益率'],
          rows: [
            ['会員サイト刷新', '480万円', '38%'],
            ['店舗アプリ', '320万円', '22%'],
            ['採用サイト', '240万円', '-4%'],
          ],
        },
      },
      {
        id: 'forecast',
        serviceId: 'sfa',
        title: '来月の受注見込み',
        tool: 'sfa.forecast',
        wave: 0,
        ms: 2400,
        logs: ['確度で重み付けして合計'],
        result: { kind: 'money', label: '来月の受注見込み', value: 10560000, note: '確度で重み付けした合計' },
      },
      {
        id: 'approve',
        serviceId: 'kintai',
        title: '勤怠の申請4件を承認',
        tool: 'kintai.approveRequests',
        wave: 1,
        ms: 1600,
        logs: ['申請内容と打刻を照合', '問題なし：4件'],
        result: { kind: 'lines', lines: ['青山 遼：有給（10/24）', '石川 凜：残業（10/15）', 'ほか2件'] },
        summaryKey: '申請4件',
        approval: { title: '勤怠の申請4件を承認します', body: '打刻と照合して問題ありませんでした。承認すると、本人に通知されます。', action: '4件を承認' },
      },
      {
        id: 'report',
        serviceId: 'doyaslide',
        title: '経営会議用の資料にまとめる',
        tool: 'doyaslide.generate',
        wave: 2,
        ms: 2600,
        logs: ['数字をグラフにする', '6枚のスライドに構成'],
        result: { kind: 'images', srcs: ['/doyaslide/template-covers/14-data-dashboard.webp', '/doyaslide/template-covers/05-trust-navy.webp'], caption: '6枚の資料（下書き）' },
      },
    ],
    summary: {
      headline: '今月の締めがまとまりました',
      points: ['総労働 7,640時間。残業45時間超が2人います', '「採用サイト」案件が赤字（-4%）です', '来月の受注見込みは 1,056万円です', '勤怠の申請4件を承認しました'],
      impact: [
        { label: '節約した時間', value: 8, unit: '時間' },
        { label: 'できた成果物', value: 5, unit: '件' },
      ],
      next: ['残業の多い2人の上長に面談を提案する', '赤字案件の追加費用を相談する'],
    },
  },
  {
    id: 'meeting',
    words: ['商談', '提案', '打ち合わせ', '訪問', '準備'],
    goal: '明日の商談の準備を、資料と見積まで一気につくる',
    thinking: ['依頼を「商談の準備」と理解しました', '相手の会社の調査と、提案資料・見積を同時に進めます'],
    tasks: [
      {
        id: 'research',
        serviceId: 'shodan',
        title: '商談先の会社を調べる',
        tool: 'shodan.prepareBriefing',
        wave: 0,
        ms: 2800,
        logs: ['公開情報から会社概要を取得', 'マーケの実施状況を確認', '課題の仮説を3つ'],
        result: { kind: 'lines', lines: ['青葉ホールディングス（従業員240人）', '仮説1：新規の入口が広告だけに偏っている', '仮説2：営業の準備に時間がかかっている'] },
      },
      {
        id: 'cunning',
        serviceId: 'cunning',
        title: '想定問答のカンペを用意',
        tool: 'cunning.prepareQA',
        wave: 0,
        ms: 2400,
        logs: ['よく聞かれる質問を10個', '自社資料から答えを用意'],
        result: { kind: 'lines', lines: ['導入までの期間は？ → 最短2週間', '既存ツールとの連携は？ → CSVとAPIで可', 'ほか8問'] },
      },
      {
        id: 'slide',
        serviceId: 'doyaslide',
        title: '提案資料をつくる',
        tool: 'doyaslide.generate',
        wave: 1,
        ms: 3200,
        logs: ['仮説に沿って構成', '8枚をデザイン'],
        result: { kind: 'images', srcs: ['/doyaslide/template-covers/05-trust-navy.webp', '/doyaslide/template-covers/15-modular-card.webp'], caption: '8枚の提案資料' },
      },
      {
        id: 'quote',
        serviceId: 'quote',
        title: '概算の見積書',
        tool: 'quote.draftQuote',
        wave: 1,
        ms: 2200,
        logs: ['提案内容から品目を設定', '公開価格で計算'],
        result: { kind: 'money', label: '概算見積', value: 635360, note: '要見積の品目は空欄のまま' },
      },
    ],
    summary: {
      headline: '明日の商談の準備ができました',
      points: ['会社の調査と課題の仮説を3つ用意しました', '提案資料8枚と概算見積をつくりました', '想定問答10問のカンペを用意しました'],
      impact: [
        { label: '節約した時間', value: 3.5, unit: '時間', decimals: 1 },
        { label: 'できた成果物', value: 4, unit: '件' },
      ],
      next: ['商談中はカンニングを開いておく', '商談後に議事録から次の一手をまとめる'],
    },
  },
]

/** 依頼が「複数のAIで片付ける経営の仕事」に当たるか（当たる言葉の数） */
export function scenarioScore(text: string) {
  const t = text.toLowerCase()
  return Math.max(...SCENARIOS.map((sc) => sc.words.filter((w) => t.includes(w.toLowerCase())).length))
}

export function pickScenario(text: string) {
  const t = text.toLowerCase()
  let best = SCENARIOS[0]
  let score = 0
  for (const sc of SCENARIOS) {
    const s = sc.words.filter((w) => t.includes(w.toLowerCase())).length
    if (s > score) {
      best = sc
      score = s
    }
  }
  return best
}
