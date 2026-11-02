// 経営ホームの「ドヤくんに頼む」の例の文（画面に依らない。テストで、作戦の組み合わせに合うことを確かめる）
// ============================================
// 部署ごとの「依頼の例」（旗 DEPARTMENTS_ROLLOUT が on のときの経営ホーム）
// ============================================
// ドヤくんが作戦に分けられる依頼は、いまは営業の「商談の準備をまとめて進める」だけ（src/lib/agent-orchestration/recipes.ts）。
// そこで部署ごとの例は、次のように分ける。
//   - セールス（と「すべて」）: 今までどおり、例を押すと依頼の欄に入り、作戦を立てられる。
//   - マーケ・人事・管理: 作戦にできない依頼を欄に入れても失敗するだけなので、欄は出さず、
//     その部署の「よく使う操作」を道具へのリンクとして並べる（押すとそのツールの画面が開く）。
// 例の中身は、経営ホームの「やりたいこと」の辞書（home/intents.ts）をそのまま使う（リンク先を二重に持たない）。
import { HOME_INTENT_GROUPS, type HomeIntent } from '@/app/(shell)/home/intents'
import { departmentOfPath, type DepartmentId } from '@/lib/departments'

/**
 * ドヤくんにまとめて頼める依頼の例（作戦の組み合わせのキーワードに合う文だけ。押すと欄に入る）。
 * ⚠️ 文を足すときは、recipes.ts の keywords のどれかを含めること（含まないと「まだ作戦にできません」になる。テストで確かめている）
 */
export const AGENT_EXAMPLES: string[] = [
  '商談の準備をまとめて進めたい',
  '来週の提案の準備をしたい',
  '訪問の準備をまとめて頼みたい',
  '商談前に相手の資料をそろえたい',
  '営業の準備を任せたい',
  '商談に行く前の資料を作りたい',
]

/**
 * 入力欄の下の例（2026-11-01 本人の指示「入力例ももっと出して」）。部署のタブで切り替え、最初は8つ、「ほかの例」で残りを出す。
 * - どれも、今あるツールで実際にできる仕事だけ（src/lib/agent-router/catalog.ts の操作か、recipes.ts の作戦）。
 * - bundle: 1つの依頼で複数のツールがつながる（いまは営業の「商談の準備」の作戦だけ。商談準備 → 見積 → スライド）。
 * - tool: 例の左に出すクマの絵（public/shell/bear/menu/<tool>-32.webp）。
 */
export interface AgentExample {
  text: string
  dept: DepartmentId
  tool: string
  bundle?: boolean
}

export const AGENT_EXAMPLE_ITEMS: AgentExample[] = [
  { text: '商談の準備をまとめて進めたい', dept: 'sales', tool: 'shodan', bundle: true },
  { text: '来月のキャンペーンのバナーを作りたい', dept: 'marketing', tool: 'banner' },
  { text: '請求書を作りたい', dept: 'admin', tool: 'income' },
  { text: 'エンジニアの面接の質問を準備したい', dept: 'hr', tool: 'mensetsu' },
  { text: '商品ページから広告画像をまとめて作りたい', dept: 'marketing', tool: 'adimage' },
  { text: '東京都の IT 企業の営業リストを作りたい', dept: 'sales', tool: 'doyalist' },
  { text: '今月の勤怠と残業を確かめたい', dept: 'hr', tool: 'kintai' },
  { text: '毎月の SaaS の支払いを登録したい', dept: 'admin', tool: 'expense' },
  // ここから下は「ほかの例」
  { text: '来週の提案の準備をしたい', dept: 'sales', tool: 'doyaslide', bundle: true },
  { text: '「営業 効率化」で読まれる記事を書きたい', dept: 'marketing', tool: 'seo' },
  { text: '自社サイトからお客さまの人物像を作りたい', dept: 'marketing', tool: 'persona' },
  { text: 'AI検索で自社がどう紹介されるか調べたい', dept: 'marketing', tool: 'aio' },
  { text: '展示会の出展の準備をしたい', dept: 'marketing', tool: 'tenjikai' },
  { text: '提案スライドを作りたい', dept: 'sales', tool: 'doyaslide' },
  { text: '見積書を作りたい', dept: 'sales', tool: 'quote' },
  { text: '新しく入った社員を登録したい', dept: 'hr', tool: 'hr' },
  { text: '社員インタビューから採用の記事を作りたい', dept: 'hr', tool: 'shanai' },
  { text: '今月の売上を見たい', dept: 'admin', tool: 'income' },
  { text: '案件ごとの工数と収支を見たい', dept: 'admin', tool: 'promane' },
]

/** 部署の例（null は全部門）。最初に出す数は first */
export function examplesFor(dept: DepartmentId | null): AgentExample[] {
  return dept ? AGENT_EXAMPLE_ITEMS.filter((e) => e.dept === dept) : AGENT_EXAMPLE_ITEMS
}
export const EXAMPLES_FIRST = 8

/** 部署の「よく使う操作」。リンク先のパスの最初の区切り（ツールの id）で部署を決める */
export function intentsOfDepartment(dept: DepartmentId): HomeIntent[] {
  return HOME_INTENT_GROUPS.flatMap((g) => g.intents).filter((i) => departmentOfPath(i.href) === dept)
}

/** ドヤくんの作戦（依頼の欄）を出す部署か。セールスと「すべて」だけ */
export function agentPlansForDepartment(dept: DepartmentId | null): boolean {
  return dept === null || dept === 'sales'
}
