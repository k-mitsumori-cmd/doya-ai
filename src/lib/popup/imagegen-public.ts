// 画面（クライアント）からも読む、画像生成の定数。sharp など、サーバーだけの部品を読み込まないよう imagegen.ts から切り分けた
export const IMAGE_BRIEF_LIMITS = { headline: 14, message: 120 } as const
/** 1人が1日に作れる回数（作り直しも1回に数える） */
export const POPUP_IMAGE_DAILY_LIMIT = 10
