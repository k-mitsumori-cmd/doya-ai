import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * 完了した記事を開いたときの「自動の画像づくり」は、1記事につき1回だけにする。
 * 試したことはサーバー側（SystemSetting の一意キー）に記録し、成功・失敗にかかわらず2回目以降は作らない。
 * 作り直しは利用者がボタンを押したとき（trigger: 'manual'）だけ。
 *
 * 以前は失敗が続くと、記事を開くたびに最大14枚（バナー4＋図解10）を作り直しており、
 * 1人1日あたり最大約950円の原価になりえた。
 */
function attemptKey(articleId: string): string {
  return `seo-image-auto:v1:${articleId}`
}

/** 一意キーの作成で記録する。作れたら true（この回だけ自動で作ってよい）、既にあれば false。 */
export async function claimSeoAutoImageAttempt(articleId: string, db: Pick<PrismaClient, 'systemSetting'> = prisma, now = new Date()): Promise<boolean> {
  try {
    await db.systemSetting.create({ data: { key: attemptKey(articleId), value: now.toISOString() } })
    return true
  } catch (error: any) {
    if (error?.code === 'P2002') return false
    throw error
  }
}

/** 本文からの呼び出しの種類。明示の 'manual' 以外は自動として扱う（古い画面からの呼び出しも自動側に寄せる）。 */
export function seoImageEnsureTrigger(body: unknown): 'auto' | 'manual' {
  return body && typeof body === 'object' && !Array.isArray(body) && (body as { trigger?: unknown }).trigger === 'manual' ? 'manual' : 'auto'
}
