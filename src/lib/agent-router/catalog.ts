// ============================================
// ドヤAIが選べる「ツールの操作」の一覧（AI に渡す選択肢）
// ============================================
// ⚠️ これは言葉の一致の表ではない。AI はこの一覧の説明を読んで、依頼に合う操作を1つ選ぶ（router.ts）。
// ⚠️ path は実在する画面。組織ごとのツールは入口（例: /expense）に ?to= を付け、入口が組織の中の画面へ運ぶ（entry.ts）。
// ⚠️ 値を受け取って入れる画面（useDoyaPrefill を使う画面）は、fields の key と画面の側の key を合わせる。
//    受け取りをまだ作っていない画面は fields を空にし、画面を開くだけにする（本人がその画面で入れる）。
// ⚠️ 開発中で隠しているツール（services.ts の hidden: 'beta'）は入れない（isBetaHiddenPath で外す）。
import { isBetaHiddenPath } from '@/lib/services'
import { AGENT_RECIPES } from '@/lib/agent-orchestration/recipes'
import { matchHomeIntent } from '@/app/(shell)/home/intents'
import { actionPath, missingFields } from './prefill'
import type { AgentPlanOption } from './router'
import type { AgentAction, AgentRoute, AgentRouteResponse } from './types'

const URL_FIELD = (label: string, ask: string) => ({ key: 'url', label, type: 'url' as const, required: true, ask })

const ALL_ACTIONS: AgentAction[] = [
  // ---- マーケティング ----
  { id: 'banner.create', toolId: 'banner', label: 'バナーを作る', description: '広告や SNS のバナー画像を作る。用途やキーワードがあれば入れる。',
    path: '/banner/dashboard/create', finalStep: '「プロ品質バナーを生成する」',
    fields: [{ key: 'keyword', label: '伝えたい言葉', type: 'text', hint: 'バナーに載せたい内容・キャッチコピーの元', ask: 'バナーで伝えたいことは何ですか？' }] },
  { id: 'adimage.create', toolId: 'adimage', label: '広告画像をまとめて作る', description: '商品やサービスのページから、媒体ごとの広告画像をまとめて作る。',
    path: '/adimage', finalStep: '「広告コピーを作る」',
    fields: [URL_FIELD('商品・サービスのページ', '広告にする商品・サービスのページの URL を教えてください'), { key: 'appeal', label: '訴求したいこと', type: 'text' }] },
  { id: 'seo.article.create', toolId: 'seo', label: 'SEO 記事を書く', description: '検索で読まれる記事を書く。狙うキーワードや記事の題があれば入れる。',
    path: '/seo/create', finalStep: '「次へ」で設定を確かめ、最後の「記事を生成する」',
    fields: [{ key: 'keyword', label: '狙うキーワード', type: 'text', required: true, ask: '記事で狙う検索キーワードは何ですか？' }, { key: 'title', label: '記事の題', type: 'text' }] },
  { id: 'persona.create', toolId: 'persona', label: 'ペルソナを作る', description: 'サイトの URL から、お客さまの人物像（ペルソナ）を作る。',
    path: '/persona', finalStep: '「ペルソナを生成」',
    fields: [URL_FIELD('サイトの URL', 'ペルソナを作るサイトの URL を教えてください'), { key: 'service', label: 'サービス名', type: 'text' }] },
  { id: 'aio.scan', toolId: 'aio', label: 'AI 検索での見え方を調べる', description: 'ChatGPT や Gemini などの AI 検索で、自社がどう言及されるかを調べる。',
    path: '/aio', finalStep: '「調査を開始」', fields: [] },
  { id: 'asklink.create', toolId: 'asklink', label: '「AIに聞く」リンクを作る', description: 'サイトに置く「AIに聞く」リンクとバナーを作る。',
    path: '/asklink', finalStep: '「作成する」', fields: [URL_FIELD('サイトの URL', 'リンクを置くサイトの URL を教えてください')] },
  { id: 'popup.create', toolId: 'popup', label: 'ポップアップを作る', description: 'サイトに出すポップアップを作り、計測する。',
    path: '/popup', finalStep: '「提案を作る」', fields: [URL_FIELD('サイトの URL', 'ポップアップを出すサイトの URL を教えてください')] },
  { id: 'interview.create', toolId: 'interview', label: '取材音声から記事を作る', description: 'インタビューの音声や動画をアップロードして、記事にする。',
    path: '/interview', finalStep: '「録音・録画のファイルを選ぶ」', fields: [] },
  { id: 'tenjikai.create', toolId: 'tenjikai', label: '展示会の準備をする', description: '展示会の出展計画・ブース・制作物・予算・締切をまとめて作る。',
    path: '/tenjikai', finalStep: '「展示会の準備を一括作成」',
    fields: [{ key: 'url', label: '自社サービスの URL', type: 'url' }, { key: 'name', label: '展示会の名前', type: 'text' }, { key: 'date', label: '会期の初日', type: 'date' }] },
  // ---- 営業 ----
  { id: 'shodan.prep.create', toolId: 'shodan', label: '商談の準備をする（1社）', description: '商談相手の会社のサイトから、企業の調査と提案の準備を作る。1社の準備だけのとき。',
    path: '/shodan?to=new', finalStep: '「この企業の商談準備をつくる」', fields: [URL_FIELD('相手の会社のサイト', '商談相手の会社のサイトの URL を教えてください')] },
  { id: 'quote.create', toolId: 'quote', label: '見積書を作る', description: '自社サービスのページを読み取り、相場つきの見積書を作る。',
    path: '/quote', finalStep: '「見積書を作成する」', fields: [{ key: 'url', label: '自社サービスのページ', type: 'url' }] },
  { id: 'doyalist.create', toolId: 'doyalist', label: '営業リストを作る', description: '業種や地域の条件から、営業先のリストを作る。',
    path: '/doyalist', finalStep: '「リストを抽出する」',
    fields: [{ key: 'keywords', label: '業種・キーワード', type: 'text', required: true, ask: 'どんな業種・キーワードの会社を探しますか？' }, { key: 'prefecture', label: '都道府県', type: 'text', hint: '例: 東京都' }] },
  { id: 'aishodan.record', toolId: 'aishodan', label: '商談の記録と要約を残す', description: '自社サービスの資料を取り込み、商談の記録と要約・シナリオを作る。', path: '/aishodan', finalStep: '「取り込む」', fields: [] },
  { id: 'doyaslide.create', toolId: 'doyaslide', label: '提案スライドを作る', description: 'テーマから、提案資料のスライドを作る。',
    path: '/doyaslide/new', finalStep: '「構成を作って画像生成へ」',
    fields: [{ key: 'theme', label: 'スライドのテーマ', type: 'text', required: true, ask: 'どんなテーマのスライドにしますか？' }] },
  { id: 'sfa.open', toolId: 'sfa', label: '商談や取引先を管理する', description: '営業管理（SFA）で、商談・取引先・タスクを見る・登録する。', path: '/sfa', finalStep: '各画面の「保存」', fields: [] },
  // ---- 人事 ----
  { id: 'mensetsu.create', toolId: 'mensetsu', label: '面接の準備をする', description: '会社の URL と職種から、面接の質問と評価の基準を作る。',
    path: '/mensetsu', finalStep: '「質問セットを生成」',
    fields: [{ key: 'url', label: '会社の URL', type: 'url' }, { key: 'job', label: '職種', type: 'text', required: true, ask: 'どの職種の面接ですか？' }, { key: 'candidate', label: '候補者の名前', type: 'text' }] },
  { id: 'hr.employee.create', toolId: 'hr', label: '社員を登録する', description: '社員の情報を登録する。', path: '/hr/employees/new', finalStep: '「登録する」', fields: [] },
  { id: 'kintai.open', toolId: 'kintai', label: '勤怠を確認・打刻する', description: '出退勤の打刻、残業、申請を見る。', path: '/kintai/dashboard', finalStep: '「打刻する」', fields: [] },
  { id: 'shanai.create', toolId: 'shanai', label: '社員インタビューの記事を作る', description: '社員インタビューから、採用広報の記事を作る。', path: '/shanai/new', finalStep: '「作る」', fields: [] },
  // ---- 経理・管理 ----
  { id: 'expense.contract.create', toolId: 'expense', label: '支出を登録する', description: '固定費・SaaS・外注費・家賃などの支払い（支出の契約）を登録する。毎月の支払予定が作られる。',
    path: '/expense?to=new-contract', finalStep: '「契約を登録する」',
    fields: [{ key: 'amount', label: '金額', type: 'yen', required: true, hint: '1回の支払いの金額（円）', ask: '支払う金額はいくらですか？' }, { key: 'title', label: '名称', type: 'text', hint: '例: Notion ビジネスプラン、デザイン外注' }, { key: 'start', label: '開始日', type: 'date' }] },
  { id: 'income.invoice.create', toolId: 'income', label: '請求書を作る', description: '取引先への請求書を作る。売上の請求もこれ。',
    path: '/income/invoices/new', finalStep: '「下書きを保存する」',
    fields: [{ key: 'amount', label: '金額（税抜）', type: 'yen', hint: '1行目の単価' }, { key: 'client', label: '取引先', type: 'text' }, { key: 'title', label: '件名', type: 'text' }, { key: 'due', label: '支払期日', type: 'date' }] },
  { id: 'income.revenue.view', toolId: 'income', label: '売上を見る', description: '今月や先月の売上予定・実績を見る。', path: '/income/revenue', finalStep: '（見るだけ）', fields: [] },
  { id: 'promane.open', toolId: 'promane', label: '案件と工数・収支を管理する', description: 'プロジェクト（案件）の工数・進み具合・収支を見る・登録する。', path: '/promane', finalStep: '各画面の「保存」', fields: [] },
]

/** AI に渡す操作の一覧（開発中で隠しているツールは外す） */
export const AGENT_ACTIONS: AgentAction[] = ALL_ACTIONS.filter((a) => !isBetaHiddenPath(a.path.split('?')[0]))

/** 作戦（複数の手順に分ける型）の一覧 */
export const AGENT_PLAN_OPTIONS: AgentPlanOption[] = AGENT_RECIPES.map((r) => ({ id: r.id, title: r.title, description: r.lead }))

export function actionById(id: string): AgentAction | undefined {
  return AGENT_ACTIONS.find((a) => a.id === id)
}

/** 確かめた答えを、画面に返す形にする */
export function routeResponse(route: AgentRoute & { planId?: string }, text: string): AgentRouteResponse {
  if (route.kind === 'action') {
    const action = actionById(route.actionId)
    if (action) {
      return {
        kind: 'action',
        action: { id: action.id, toolId: action.toolId, label: action.label, finalStep: action.finalStep, fields: action.fields },
        values: route.values,
        missing: missingFields(action, route.values),
        // 値は URL に載せない（画面が sessionStorage に入れ、鍵だけを付けて開く）
        href: actionPath(action),
        reason: route.reason,
      }
    }
  }
  if (route.kind === 'plan' && route.planId) return { kind: 'plan', planId: route.planId, reason: route.reason }
  const ids = route.kind === 'unknown' ? route.suggestions : []
  const links = ids.map((id) => actionById(id)).filter((a): a is AgentAction => Boolean(a)).map((a) => ({ label: a.label, href: actionPath(a) }))
  return links.length ? { kind: 'unknown', reason: route.reason, suggestions: links } : fallbackRoute(text, route.reason)
}

/** AI を使えないとき（上限・障害・鍵が無い）に、言葉の一致で近いツールを案内する（行き止まりにしない） */
export function fallbackRoute(text: string, reason = ''): AgentRouteResponse {
  const intent = matchHomeIntent(text)
  return { kind: 'unknown', reason, suggestions: intent ? [{ label: intent.label, href: intent.href }] : [] }
}
