// ============================================
// ドヤ広告バナーAI 広告特化プロンプト（gpt-image-2 用に新規設計）
// ============================================
import type { AdMedia, LogoPos } from './types'
import { MEDIA_LABEL } from './types'

const MEDIA_REG: Record<AdMedia, string> = {
  meta: 'Meta広告。文字は画面の20%以内を目安に、ビジュアル主体で。',
  google: 'Googleディスプレイ広告。小サイズでも視認できる大きめの文字とロゴ枠。',
  line: 'LINE広告。親しみやすく、CTAボタンを明確に。',
  x: 'X(Twitter)広告。タイムラインで目を引く高コントラスト。',
  yda: 'Yahoo!広告。誇大表現を避け、信頼感のある構成。',
  other: '一般的なWeb広告のベストプラクティスに従う。',
}

const LOGO_POS_JA: Record<LogoPos, string> = {
  'top-left': '左上', 'top-right': '右上', 'bottom-left': '左下', 'bottom-right': '右下', 'center': '中央上部',
}

export interface BannerPromptInput {
  serviceName: string
  description?: string
  appeal?: string // 訴求軸メモ
  appealAxis?: string // ベネフィット/限定 等
  tone?: string
  brandColors?: string[]
  media: AdMedia
  aspect: 'square' | 'landscape' | 'portrait'
  hasLogo?: boolean
  logoPos?: LogoPos
}

export function buildBannerPrompt(i: BannerPromptInput): string {
  const colors = (i.brandColors || []).filter(Boolean).slice(0, 4)
  const aspectJa = i.aspect === 'square' ? '正方形' : i.aspect === 'landscape' ? '横長' : '縦長'
  const lines: string[] = [
    `日本語の広告バナー（${aspectJa}）をデザインしてください。媒体: ${MEDIA_LABEL[i.media]}。`,
    `商材: ${i.serviceName}${i.description ? `（${i.description}）` : ''}`,
    i.appealAxis ? `訴求軸: ${i.appealAxis}` : '',
    i.appeal ? `訴求メモ: ${i.appeal}` : '',
    i.tone ? `トーン: ${i.tone}` : '',
    '',
    '# 必須要件（広告として成果を出すための条件）',
    '- 3秒で何の広告か伝わること。最も訴えたいベネフィットを一番大きな見出しにする。',
    '- 日本語のキャッチコピー（見出し）とサブコピー、明確なCTA（例: 今すぐ無料で試す／資料請求はこちら）を入れる。',
    '- 文字は大きく可読性高く。背景と十分なコントラスト。重要語を強調。',
    `- ${MEDIA_REG[i.media]}`,
    colors.length ? `- ブランドカラー ${colors.join(' , ')} を基調に、配色を統一する。` : '- 商材に合うプロフェッショナルな配色。',
    '- プロのアートディレクター品質。安っぽいクリップアートやストックフォト感を避ける。',
    '',
    '# 文字の品質',
    '- 日本語テキストは正確で自然な字形。誤字・崩れた文字・意味のない文字列を入れない。',
  ]
  if (i.hasLogo && i.logoPos) {
    lines.push(
      '',
      '# ロゴ用セーフゾーン（重要）',
      `- ${LOGO_POS_JA[i.logoPos]}に、ロゴを後から重ねるための「無地・単色の余白（セーフゾーン）」を確保する。`,
      '- そのセーフゾーンには文字・図形・装飾を一切置かない（後で実ロゴを合成するため）。',
      '- ロゴ自体やブランド名のロゴタイプはAIで描かない。',
    )
  } else {
    lines.push('', '- ロゴやブランドのロゴタイプは描かない（後で正規ロゴを合成する場合があるため、企業ロゴ風の図形は避ける）。')
  }
  return lines.filter(Boolean).join('\n')
}
