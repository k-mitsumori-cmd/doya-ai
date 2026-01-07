import { prisma } from './prisma'

/**
 * データベースからGTM IDを取得
 * 環境変数が優先、なければデータベースから取得
 */
export async function getGtmId(): Promise<string | null> {
  // 環境変数が設定されていれば優先
  const envGtmId = process.env.NEXT_PUBLIC_GTM_ID
  if (envGtmId) {
    return envGtmId
  }

  // データベースから取得
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'gtm_id' },
      select: { value: true },
    })
    
    // 値が存在し、空文字でない場合のみ返す
    if (setting?.value && setting.value.trim()) {
      return setting.value.trim()
    }
    
    return null
  } catch (e) {
    // データベース接続エラーなどは静かに無視（環境変数にフォールバック）
    // 本番環境ではログに記録することを推奨
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to get GTM ID from database:', e)
    }
    return null
  }
}

