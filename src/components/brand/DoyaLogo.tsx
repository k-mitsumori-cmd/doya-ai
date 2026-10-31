// ============================================
// ドヤAI のロゴ（記号＋文字）
// 記号は青い角丸の板にドヤくんの顔を載せた画像（背景は透過）。文字は画像にせずテキストで出す。
// 記号は装飾なので alt は空。名前は隣の文字が担う（文字を出さない場合は呼び出し側で aria-label を付ける）。
// 画像は表示の 2 倍の解像度（64 / 128 の webp）を使い、width と height を必ず指定してずれを防ぐ。
// ============================================
import Image from 'next/image'
import { isBrandRenamed } from '@/lib/brand'

type Props = {
  /** 記号の一辺（px）。 */
  size?: number
  /** 「ドヤAI」の文字を隣に出すか。 */
  showText?: boolean
  className?: string
  textClassName?: string
}

export function DoyaLogoMark({ size = 28, className }: { size?: number; className?: string }) {
  // 表示 32px 以下は 64px（2倍）、それより大きければ 128px を使う
  // 旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときは、ドヤバディの新しいアイコン（青い板にドヤ顔のクマ）。off の間は今の記号のまま
  const renamed = isBrandRenamed()
  const small = size <= 32
  const src = renamed
    ? small ? '/brand/doya-buddy/icon/doya-buddy-icon-64.png' : '/brand/doya-buddy/icon/doya-buddy-icon-128.png'
    : small ? '/brand/doya-logo-mark-64.webp' : '/brand/doya-logo-mark-128.webp'
  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden
      unoptimized
      className={className}
      style={{ width: size, height: size, flex: 'none', objectFit: 'contain' }}
    />
  )
}

export default function DoyaLogo({ size = 28, showText = true, className, textClassName }: Props) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.35) }}>
      <DoyaLogoMark size={size} />
      {showText ? <span className={textClassName}>ドヤAI</span> : null}
    </span>
  )
}
