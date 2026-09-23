import { Prisma } from '@prisma/client'
import { seoExecutionContext } from '@seo/lib/execution-context'
import { withSeoJobExecution, SeoExecutionLostError } from '@seo/lib/job-execution'
import { prisma } from '@/lib/prisma'

/** Article and job completion must commit together, without reviving a stopped job. */
export async function completeSeoJob(jobId: string, articleId: string, owner: { userId: string | null; guestId: string | null }): Promise<boolean> {
  try {
    const complete = async (tx: Prisma.TransactionClient) => {
      await tx.seoArticle.update({
        where: { id: articleId, ...owner, jobs: { some: { id: jobId, status: 'running' } } },
        data: { status: 'DONE' },
      })
      await tx.seoJob.update({
        where: { id: jobId, articleId, status: 'running' },
        data: { status: 'done', step: 'done', progress: 100, finishedAt: new Date() },
      })
    }
    const execution = seoExecutionContext.getStore()
    if (execution) {
      if (execution.jobId !== jobId || execution.articleId !== articleId) throw new SeoExecutionLostError()
      await withSeoJobExecution(execution, complete)
    } else {
      await prisma.$transaction(complete)
    }
    return true
  } catch (error: any) {
    if (error?.code === 'P2025') return false
    throw error
  }
}
