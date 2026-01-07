import { prisma } from './prisma'
import { PLANS, PlanType } from './stripe'

/**
 * JST基準で今日の日付を取得
 */
function getTodayJST(): Date {
  const now = new Date()
  // JSTはUTC+9
  const jstOffset = 9 * 60 * 60 * 1000
  const jstDate = new Date(now.getTime() + jstOffset)
  // 日付のみ（時刻を00:00:00に）
  return new Date(Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate()))
}

/**
 * ユーザーの日次使用量を取得
 */
export async function getDailyUsage(userId: string): Promise<number> {
  const today = getTodayJST()
  
  const usage = await prisma.usageDaily.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  })
  
  return usage?.count ?? 0
}

/**
 * クォータをチェックし、使用可能かどうかを返す
 * 同時実行対策: トランザクション内でSELECT FOR UPDATEを使用
 */
export async function checkAndIncrementQuota(
  userId: string,
  plan: PlanType
): Promise<{ allowed: boolean; currentUsage: number; limit: number | null }> {
  const limit = PLANS[plan].dailyLimit
  
  // 無制限プランの場合
  if (limit === null) {
    // 使用量は記録するが制限なし
    await incrementUsage(userId)
    const usage = await getDailyUsage(userId)
    return { allowed: true, currentUsage: usage, limit: null }
  }
  
  const today = getTodayJST()
  
  // トランザクションで排他制御
  return await prisma.$transaction(async (tx) => {
    // UsageDailyをUPSERTし、同時にカウントをチェック
    const existing = await tx.usageDaily.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    })
    
    const currentCount = existing?.count ?? 0
    
    if (currentCount >= limit) {
      return { allowed: false, currentUsage: currentCount, limit }
    }
    
    // カウントをインクリメント
    await tx.usageDaily.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      create: {
        userId,
        date: today,
        count: 1,
      },
      update: {
        count: {
          increment: 1,
        },
      },
    })
    
    return { allowed: true, currentUsage: currentCount + 1, limit }
  }, {
    isolationLevel: 'Serializable', // 最も厳格な分離レベル
  })
}

/**
 * 使用量をインクリメント（無制限プラン用）
 */
async function incrementUsage(userId: string): Promise<void> {
  const today = getTodayJST()
  
  await prisma.usageDaily.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    create: {
      userId,
      date: today,
      count: 1,
    },
    update: {
      count: {
        increment: 1,
      },
    },
  })
}

/**
 * ユーザーのクォータ情報を取得
 */
export async function getQuotaInfo(userId: string, plan: PlanType): Promise<{
  used: number
  limit: number | null
  remaining: number | null
}> {
  const used = await getDailyUsage(userId)
  const limit = PLANS[plan].dailyLimit
  
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  }
}

