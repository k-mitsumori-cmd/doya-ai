// ============================================
// ドヤAI質問リンク 質問文とバナー文言の生成（4-2 / 4-3）
// ============================================
// ⚠️ 質問文は訪問者本人の発言として ChatGPT に表示される。指示書の口調にしない。
// ⚠️ 模範の文面をプロンプトに丸ごと入れない。例文はそのまま写り、どのサイトでも同じ文になる。
//    ルールと型だけを渡す。
// ⚠️ 避けたい語をプロンプトに並べない。指示に書いた語はそのまま本文に漏れる。
//    守られたかは link.ts の機械チェックで判定し、不合格なら理由を添えて作り直す（最大2回）。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildLink, checkButtonLabel, countChars, extractUrls } from './link'
import type { AskLink, Audience, BannerCopy, LinkKey, SiteProfile } from './types'

const MAX_REGENERATE = 2

interface LinkPlan {
  key: LinkKey
  title: string
  /** 生成したボタン名が使えないときの既定（15字以内） */
  fallbackLabel: string
  /** 何についての質問か（訪問者の目的） */
  goal: string
  /** 最初に聞いてもらう3つ */
  askAbout: string
  /** 回答として作ってほしいもの */
  deliverables: string
  /** 最後に添えるページ */
  pageHint: string
}

/** どの2本を作るか（ToB/ToCで切り替え。問い合わせ窓口が無いToBは2本目を差し替え） */
export function planLinks(audience: Audience, site: SiteProfile): LinkPlan[] {
  if (audience === 'b2c') {
    return [
      {
        key: 'choose',
        title: '自分に合う商品・プランを選びたい',
        fallbackLabel: '自分に合うものを探す',
        goal: `${site.name}の商品やプランの中から、自分に合うものを選びたい`,
        askAbout: '用途・予算・重視する点',
        deliverables: '好みや状況に合いそうな候補を2〜3個に絞り、それぞれの合う理由と気をつける点',
        pageHint: '選ぶときに見るとよいページ',
      },
      {
        key: 'reassure',
        title: '購入・予約の前に不安を解消したい',
        fallbackLabel: '気になることを相談する',
        goal: `${site.name}で購入や予約をする前に、気になっていることを解消したい`,
        askAbout: '気になっていること・利用する時期・これまでの経験',
        deliverables: 'よくある不安とその確認方法、事前に確かめておくとよいことのリスト',
        pageHint: '次に見るとよいページ',
      },
    ]
  }
  const first: LinkPlan = {
    key: 'understand',
    title: `${site.name}で何ができる？`,
    fallbackLabel: 'AIに使い方を聞く',
    goal: `${site.name}で何ができるのかを知り、自社に合う使い方を考えたい`,
    askAbout: '業種・会社の規模・解決したいこと',
    deliverables: '自社に合いそうな使い方の案と、相談するときに送れる短い相談文',
    pageHint: '自分に合いそうなページ',
  }
  if (!site.contactUrl) {
    return [
      first,
      {
        key: 'pages',
        title: '資料・ページを選びたい',
        fallbackLabel: '読むページを選ぶ',
        goal: `${site.name}について、自分に必要な資料やページから読み始めたい`,
        askAbout: '知りたいこと・検討している時期・社内で共有する相手',
        deliverables: '読む順番のおすすめと、読みながら確認するとよい点',
        pageHint: '最初に読むとよいページ',
      },
    ]
  }
  return [
    first,
    {
      key: 'prepare',
      title: '無料相談・問い合わせの準備をしたい',
      fallbackLabel: '相談の準備をする',
      goal: `${site.name}の相談・問い合わせを申し込む前に、しっかり準備したい`,
      askAbout: '業種・会社の規模・相談したいこと',
      deliverables: '相談で聞いておくとよい質問5つ、事前に用意しておく数字や資料のチェックリスト、申し込みフォームに貼れる200字くらいの相談文',
      pageHint: '申し込みページ',
    },
  ]
}

function siteFacts(site: SiteProfile): string {
  const lines = [
    `名前: ${site.name}`,
    site.summary && `内容: ${site.summary}`,
    site.strengths.length > 0 && `強み: ${site.strengths.join(' / ')}`,
    site.target && `対象: ${site.target}`,
  ]
  return lines.filter(Boolean).join('\n')
}

function urlList(site: SiteProfile, allowedUrls: string[]): string {
  const labeled: string[] = []
  if (site.contactUrl) labeled.push(`問い合わせ・相談: ${site.contactUrl}`)
  if (site.downloadUrl) labeled.push(`資料ダウンロード: ${site.downloadUrl}`)
  if (site.pricingUrl) labeled.push(`料金: ${site.pricingUrl}`)
  for (const p of site.pages) labeled.push(`${p.label}: ${p.url}`)
  const rest = allowedUrls.filter((u) => !labeled.some((l) => l.endsWith(u)))
  for (const u of rest) labeled.push(`トップ: ${u}`)
  return labeled.join('\n')
}

interface RawLink {
  buttonLabel?: string
  question?: string
}

function linkPrompt(plan: LinkPlan, site: SiteProfile, allowedUrls: string[], feedback: string[]): string {
  return [
    `Webサイトに置く「AIに聞く」ボタンの文面を1つ作ります。訪問者がボタンを押すと、この文面が訪問者本人の発言として ChatGPT に送られます。`,
    '',
    '【訪問者の目的】',
    plan.goal,
    '',
    '【文面の型】次の順で、1つの自然な話し言葉の文章にしてください。',
    '1. 訪問者の気持ちから書き始める（「〜が気になっています」「〜したいと思っています」のように）',
    `2. 「まず私の${plan.askAbout}の3つを、答えやすい選択肢つきで1問ずつ聞いてもらえますか？」という趣旨で、最初に聞いてほしいことを書く`,
    `3. そのうえで作ってほしいものを、1行に1つずつ「1. 」「2. 」のような番号つきで改行して書く: ${plan.deliverables}`,
    '4. サイトの要点は「〜があるようですが」のように、訪問者がサイトで知った情報として1〜2点入れる',
    `5. 最後に「${plan.pageHint}も教えてください」の趣旨で、下のURL一覧からURLを1〜2個そのまま書く`,
    '6. 料金や実績など、サイトで確認できないことは「相談で確認したいことに入れておいてください」と書く',
    '',
    '【書き方】',
    '- 一人称は「私」「うちの会社」。丁寧で前向きな話し言葉',
    '- お願いは「〜してもらえますか」「〜だと助かります」の形',
    '- AIに役割や立場を与える書き方をしない。あくまで訪問者が相談している文にする',
    '- 全体で300〜380字',
    '- URLは下の一覧にあるものを一字一句そのまま使い、一覧に無いURLは書かない',
    '',
    '【ボタン名】ボタンに表示する短い言葉（10字前後、長くても15字まで）。訪問者が押したくなる、質問の内容が分かる言葉',
    '',
    '【サイトの情報】',
    siteFacts(site),
    '',
    '【使ってよいURL一覧】',
    urlList(site, allowedUrls),
    ...(feedback.length ? ['', '【前回の文面の直すところ】', ...feedback.map((f) => `- ${f}`)] : []),
    '',
    '【出力するJSONの形式】',
    '{ "buttonLabel": "ボタン名", "question": "文面" }',
  ].join('\n')
}

/** 機械チェックの理由を、作り直しの指示に言い換える（避けたい語そのものはプロンプトに書かない） */
function toFeedback(issues: string[]): string[] {
  const out = new Set<string>()
  for (const i of issues) {
    if (i.includes('URL')) {
      if (i.includes('長すぎ')) out.add('文面をもっと短くする（300字程度）')
      else out.add('URLは一覧にあるものだけを、一字一句そのまま使う')
    } else if (i.includes('字を超え')) out.add('文面をもっと短くする（300字程度）')
    else if (i.includes('ボタン名')) out.add('ボタン名を15字以内の短い言葉にする')
    else if (i.includes('空')) out.add('文面を必ず書く')
    else out.add('命令や指示の口調、業界用語を使わず、訪問者のお願いの形にする')
  }
  return [...out]
}

/** 質問文にサイトのURLが1つ以上入っているか（型の5番。入っていなければ作り直す） */
function hasSiteUrl(question: string): boolean {
  return extractUrls(question).length > 0
}

/**
 * 1本を作る。機械チェック（link.ts）に通らなければ理由を添えて作り直す（最大2回）。
 * URLが1つも無いものも作り直す（不合格にはしない。最後まで入らなければそのまま返す）。
 * ボタン名だけが使えないときは、作り直さずに既定のボタン名へ差し替える。
 */
async function generateOne(plan: LinkPlan, site: SiteProfile, allowedUrls: string[]): Promise<AskLink> {
  let feedback: string[] = []
  let best: AskLink | null = null
  for (let attempt = 0; attempt <= MAX_REGENERATE; attempt++) {
    let raw: RawLink | null = null
    try {
      raw = await geminiGenerateJson<RawLink>(
        { prompt: linkPrompt(plan, site, allowedUrls, feedback), model: GEMINI_TEXT_MODEL_DEFAULT },
        'AskLinkQuestion'
      )
    } catch (e) {
      // 生成そのものの失敗は次の試行へ。最後まで失敗したら要確認の空リンクを返す
      console.warn('[asklink] question generation failed', (e as Error)?.name)
    }
    const question = String(raw?.question || '').trim()
    let buttonLabel = String(raw?.buttonLabel || '').trim()
    if (checkButtonLabel(buttonLabel).length > 0) buttonLabel = plan.fallbackLabel
    const link = buildLink(plan.key, plan.title, buttonLabel, question, allowedUrls)
    const withUrl = hasSiteUrl(link.question)
    if (!link.needsReview && withUrl) return link
    // 合格しているものを優先して残す（URLが無いだけのものは、不合格のものより良い）
    if (!best || (best.needsReview && !link.needsReview)) best = link
    feedback = toFeedback(link.check.issues)
    if (!withUrl) feedback.push(`最後に「${plan.pageHint}も教えてください」と書き、続けて使ってよいURL一覧からURLを1〜2個そのまま書く`)
  }
  return best!
}

export async function generateLinks(audience: Audience, site: SiteProfile, allowedUrls: string[]): Promise<AskLink[]> {
  const plans = planLinks(audience, site)
  return Promise.all(plans.map((p) => generateOne(p, site, allowedUrls)))
}

// ---------- バナー文言 ----------

const BANNER_LIMITS = { headline: 16, sub: 26, bubble: 8 }

function defaultCopy(audience: Audience, site: SiteProfile): BannerCopy {
  const sub = `${site.name}のことを、会話でチェック。`
  return {
    headline: 'その疑問、AIに聞いてみよう。',
    sub: countChars(sub) <= BANNER_LIMITS.sub ? sub : '気になることを、会話でチェック。',
    bubbles: audience === 'b2c' ? ['どれが合う？', '予算はいくら？', '何を選ぶ？'] : ['何を頼める？', 'どう活用する？', '何を解決できる？'],
  }
}

/**
 * バナーの文言（見出し・小見出し・吹き出し3つ）。吹き出しは1本目のリンクの内容に合わせる。
 * 字数を超えたら既定の文言へ落とす（画像に焼く文字は短くないと崩れる）。
 */
export async function generateBannerCopy(audience: Audience, site: SiteProfile, firstLink: AskLink): Promise<BannerCopy> {
  const fallback = defaultCopy(audience, site)
  const prompt = [
    'Webサイトのポップアップに出す「AIに聞く」バナーの文言を作ります。ボタンを押すと ChatGPT が開き、下の質問が送られます。',
    '',
    `【サイト】${site.name}${site.summary ? `（${site.summary}）` : ''}`,
    `【ボタンで送られる質問の内容】${firstLink.title}`,
    '',
    '【作るもの】',
    `- headline: 大見出し。訪問者に語りかける短い言葉（${BANNER_LIMITS.headline - 4}字前後、${BANNER_LIMITS.headline}字以内）`,
    `- sub: 小見出し。サイト名を入れて何を相談できるかを一言で（20字前後、${BANNER_LIMITS.sub}字以内）`,
    `- bubbles: 訪問者が聞きたくなる短い疑問を3つ（各${BANNER_LIMITS.bubble}字以内、「？」で終える）。質問の内容に合わせる`,
    '',
    '【出力するJSONの形式】',
    '{ "headline": "", "sub": "", "bubbles": ["", "", ""] }',
  ].join('\n')
  try {
    const raw = await geminiGenerateJson<{ headline?: string; sub?: string; bubbles?: string[] }>(
      { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
      'AskLinkBannerCopy'
    )
    const headline = String(raw?.headline || '').trim()
    const sub = String(raw?.sub || '').trim()
    const bubbles = (Array.isArray(raw?.bubbles) ? raw.bubbles : []).map((b) => String(b || '').trim())
    return {
      headline: headline && countChars(headline) <= BANNER_LIMITS.headline ? headline : fallback.headline,
      sub: sub && countChars(sub) <= BANNER_LIMITS.sub ? sub : fallback.sub,
      bubbles:
        bubbles.length === 3 && bubbles.every((b) => b && countChars(b) <= BANNER_LIMITS.bubble)
          ? (bubbles as [string, string, string])
          : fallback.bubbles,
    }
  } catch (e) {
    console.warn('[asklink] banner copy generation failed', (e as Error)?.name)
    return fallback
  }
}
