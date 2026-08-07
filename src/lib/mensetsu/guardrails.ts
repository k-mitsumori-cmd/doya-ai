// ============================================
// ドヤ面接官 ガードレール（C3: 差別的評価の排除）
// ============================================
// 就職差別につながる「本人に責任のない事項」「本来自由であるべき事項」を
// (1) 質問生成時にブロックし、(2) 面接中に応募者が自発的に述べた場合も評価根拠に使わない。
// 厚労省の「公正な採用選考の基本」で禁止されている領域に準拠する。

/** 質問・評価から排除する属性 */
export const PROHIBITED_TOPICS = [
  '本籍・出生地',
  '家族の職業・続柄・地位・学歴・収入',
  '住宅状況（間取り・持ち家/借家など）',
  '生活環境・家庭環境',
  '宗教',
  '支持政党・政治的信条',
  '人生観・生活信条',
  '尊敬する人物',
  '思想',
  '労働組合・学生運動などの社会運動',
  '購読新聞・雑誌・愛読書',
  '性別・性自認・性的指向',
  '年齢',
  '国籍・人種・民族',
  '結婚・出産・育児の予定',
  '病歴・障害の有無（業務上必要な合理的配慮の確認を除く）',
] as const

/** LLMプロンプトに差し込む禁止事項ブロック */
export const GUARDRAIL_PROMPT = `
【絶対に守る制約（就職差別の防止）】
以下の事項は、質問してはならず、評価の根拠にしてもならない:
${PROHIBITED_TOPICS.map((t) => `- ${t}`).join('\n')}

- 質問は必ず「その職務を遂行する能力・意欲・適性」に関するものに限定すること。
- 応募者が自発的にこれらの話題に触れた場合も、評価には一切使わないこと。
- 「一般常識」「人柄を知るため」といった理由でも上記を尋ねないこと。
`.trim()

/** 生成された質問文が禁止領域に触れていないかの軽量チェック（後段の安全網） */
const RED_FLAG_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /本籍|出身地|生まれ(は|た場所)/, label: '本籍・出生地' },
  { re: /(父|母|両親|家族|兄弟|姉妹)の(職業|仕事|勤務先|収入|学歴)/, label: '家族の職業・収入・学歴' },
  { re: /(持ち家|借家|間取り|住宅事情)/, label: '住宅状況' },
  { re: /宗教|信仰/, label: '宗教' },
  { re: /支持(する)?政党|政治的(信条|立場)/, label: '支持政党・政治的信条' },
  { re: /尊敬する(人物|人)/, label: '尊敬する人物' },
  { re: /愛読書|購読(している)?(新聞|雑誌)/, label: '愛読書・購読紙誌' },
  { re: /労働組合|学生運動/, label: '社会運動' },
  { re: /結婚(の予定|する予定|されて)|出産(の予定)|子ども(を持つ)?予定/, label: '結婚・出産の予定' },
  { re: /(性別|性自認|性的指向)/, label: '性別・性自認・性的指向' },
  { re: /国籍|人種|民族/, label: '国籍・人種・民族' },
  { re: /(何|なん)歳|年齢は/, label: '年齢' },
  { re: /持病|既往歴|障害(者)?(手帳)?(をお持ち|はあり)/, label: '病歴・障害の有無' },
]

export interface GuardrailViolation {
  text: string
  label: string
}

/** 質問リストを検査し、禁止領域に触れるものを返す */
export function findViolations(texts: string[]): GuardrailViolation[] {
  const out: GuardrailViolation[] = []
  for (const text of texts) {
    for (const { re, label } of RED_FLAG_PATTERNS) {
      if (re.test(text)) {
        out.push({ text, label })
        break
      }
    }
  }
  return out
}

/** 違反した質問を除去する（生成のやり直しコストを避けるための後処理） */
export function stripViolations<T extends { text: string }>(items: T[]): {
  kept: T[]
  removed: GuardrailViolation[]
} {
  const removed: GuardrailViolation[] = []
  const kept = items.filter((item) => {
    for (const { re, label } of RED_FLAG_PATTERNS) {
      if (re.test(item.text)) {
        removed.push({ text: item.text, label })
        return false
      }
    }
    return true
  })
  return { kept, removed }
}
