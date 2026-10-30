// ============================================
// サポートチャットの答えの材料と、よくある質問の候補
// ============================================
// 答えの範囲は「ドヤAIの説明・料金・使い方」に限る（設計書 4.1）。材料はここに集める。
// ⚠️ 金額やツールの一覧は直書きしない。unified-plan.ts と services.ts から読む（料金は新プランの準備中のため）。
// ⚠️ 答えには必ずリンクを添える。リンクの無い材料は作らない。
import { isBrandRenamed } from '@/lib/brand'
import { getListedServices, type Service } from '@/lib/services'
import { UNIFIED_PLAN_COPY, UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'

export type SupportSource = { label: string; href: string }

export type KnowledgeEntry = {
  id: string
  title: string
  /** 答えの本文（そのまま利用者に出す） */
  body: string
  /** この言葉が質問に入っていたら当てる */
  keywords: string[]
  source: SupportSource
  /** ツールの材料なら services.ts の id */
  toolId?: string
}

export const SUPPORT_HOURS_LABEL = '平日 10時〜18時（土日祝・年末年始を除く）'

function staticEntries(): KnowledgeEntry[] {
  const count = getListedServices().length
  return [
    {
      id: 'about',
      title: 'ドヤAIとは',
      body: `ドヤAIは、中小企業の仕事を手伝うAIツールの集まりです。1つのアカウントで、${count}のツールを使えます。記事やバナーを作る、営業や人事の管理をする、といった仕事をAIが手伝います。`,
      keywords: ['ドヤAI', ...(isBrandRenamed() ? ['ドヤ部下', 'ドヤ部下とは'] : []), 'ドヤaiとは', '何ができ', 'なにができ', 'どんなサービス', 'とは'], // brand-keep: 旧名・新名のどちらで聞かれても答える
      source: { label: 'ツールの一覧を見る', href: '/' },
    },
    {
      id: 'plans',
      title: '料金プラン',
      body: `料金は「${UNIFIED_PLAN_COPY.freeName}」と「${UNIFIED_PLAN_COPY.proName}（月${UNIFIED_PRO_PRICE_LABEL}・税込）」の2つです。${UNIFIED_PLAN_COPY.proNote}最新の金額と、できることの違いは料金ページでご確認ください。`,
      keywords: ['料金', '値段', '価格', 'いくら', 'プラン', '有料', 'プロプラン', '無料プラン', '月額'],
      source: { label: '料金ページを開く', href: '/pricing' },
    },
    {
      id: 'trial',
      title: '無料で試せるか',
      body: '無料プランのまま、各ツールを回数の上限まで試せます。プロプランのお試しの期間は、対象の方にだけ料金ページで表示しています。',
      keywords: ['無料で', 'お試し', 'トライアル', '試せ', 'ためせ', 'ただで'],
      source: { label: '料金ページを開く', href: '/pricing' },
    },
    {
      id: 'upgrade',
      title: 'プロプランへの切り替え',
      body: 'プロプランへの切り替えは、料金ページの申し込みボタンから行えます。1つの契約で、すべてのツールのプロ機能が使えるようになります。',
      keywords: ['アップグレード', '切り替え', '申し込み', '申込', '契約したい', 'プロにしたい'],
      source: { label: '料金ページを開く', href: '/pricing' },
    },
    {
      id: 'doya-power',
      title: 'ドヤパワー',
      body: 'ドヤパワーは、AIで作るときに使う回数の目安です。残りは画面の左下で確かめられます。このチャットで質問しても、ドヤパワーは減りません。',
      keywords: ['ドヤパワー', 'ポイント', 'パワー', '残り', '回数'],
      source: { label: '料金ページを開く', href: '/pricing' },
    },
    {
      id: 'login',
      title: 'ログインの方法',
      body: 'ドヤAIには、Google アカウントでログインします。ログインの画面で「Google でログイン」を押してください。',
      keywords: ['ログイン', 'サインイン', 'アカウント', 'google', 'グーグル', '登録'],
      source: { label: 'ログインの画面を開く', href: '/auth/signin' },
    },
    {
      id: 'choose-tool',
      title: 'どのツールを使えばよいか',
      body: `やりたいことに近いツールを、一覧から選んでください。例えば、記事を書くなら「ドヤ記事作成」、バナーを作るなら「ドヤバナーAI」、営業の管理なら「ドヤ営業管理」です。迷ったら、やりたいことをこのチャットに書いてください。`,
      keywords: ['どのツール', 'おすすめ', 'どれを使', '迷', '選び方', 'どれがいい'],
      source: { label: 'ツールの一覧を見る', href: '/' },
    },
    {
      id: 'privacy',
      title: '個人情報の扱い',
      body: '個人情報の扱いは、プライバシーポリシーに書いています。データの削除をご希望の場合は、「運営に伝える」からお知らせください。',
      keywords: ['個人情報', 'プライバシー', 'セキュリティ', '安全', '学習に使'],
      source: { label: 'プライバシーポリシーを開く', href: '/privacy' },
    },
    {
      id: 'terms',
      title: '利用規約',
      body: 'ご利用の条件は、利用規約に書いています。',
      keywords: ['規約', '利用条件', '商用利用', '著作権'],
      source: { label: '利用規約を開く', href: '/terms' },
    },
    {
      id: 'hours',
      title: '問い合わせの受付時間',
      body: `運営の担当者がお答えする時間は、${SUPPORT_HOURS_LABEL}です。このチャットのAIは、いつでも使い方の質問に答えます。`,
      keywords: ['営業時間', '受付時間', '何時', '休み', '土日', '電話'],
      source: { label: '特定商取引法に基づく表記を開く', href: '/tokushoho' },
    },
  ]
}

function statusNote(s: Service): string {
  if (s.status === 'coming_soon') return '今は開発中です。公開まで少しお待ちください。'
  if (s.status === 'maintenance') return '今は調整中で、一部の機能が使えない場合があります。'
  if (s.status === 'beta') return '今はベータ版として公開しています。'
  return ''
}

function toolEntry(s: Service): KnowledgeEntry {
  const features = s.features.slice(0, 4).map((f) => `- ${f}`).join('\n')
  const lead = `${s.name}は、${s.description.replace(/[。.]$/, '')}ためのツールです。`
  const body = [lead, statusNote(s), features ? `主にできることは次のとおりです。\n${features}` : '', '使い方は、ツールの画面の案内に沿って進めてください。']
    .filter(Boolean)
    .join('\n')
  const keywords = [s.name, s.shortName, s.id].filter((v): v is string => Boolean(v && v.length >= 2))
  return { id: `tool:${s.id}`, title: s.name, body, keywords, source: { label: `${s.name}を開く`, href: s.href }, toolId: s.id }
}

/** 答えの材料（毎回作る。services.ts の変更がそのまま反映される） */
export function knowledgeEntries(): KnowledgeEntry[] {
  return [...staticEntries(), ...getListedServices().map(toolEntry)]
}

/** パスから、そのツールの id を引く（一番長く当たる href を選ぶ） */
export function toolIdForPath(pathname: string | null | undefined): string | null {
  const p = pathname || '/'
  let best: Service | null = null
  for (const s of getListedServices()) {
    if (!s.href || s.href === '/') continue
    if (p === s.href || p.startsWith(`${s.href}/`)) {
      if (!best || s.href.length > best.href.length) best = s
    }
  }
  return best?.id ?? null
}

export function toolNameOf(toolId: string | null | undefined): string | null {
  if (!toolId) return null
  return getListedServices().find((s) => s.id === toolId)?.name ?? null
}

/** よくある質問の候補。今のツールがあれば、そのツール向けを先に出す（最大5件） */
export function suggestedQuestions(toolId: string | null | undefined): string[] {
  const name = toolNameOf(toolId)
  const tool = name ? [`${name}で何ができますか`, `${name}の使い方を教えてください`] : []
  const general = ['ドヤAIでは何ができますか', '料金プランを教えてください', 'どのツールを使えばよいですか', 'ドヤパワーとは何ですか']
  return [...tool, ...general].slice(0, 5)
}
