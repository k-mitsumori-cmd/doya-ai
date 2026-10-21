'use client'

import Link from 'next/link'
import type { Section } from '@/lib/tenjikai/nav'
import type { ProjectDetailResponse } from '@/lib/tenjikai/project-detail-mode'
import type { SavedDetailPhase } from '@/lib/tenjikai/use-saved-project-detail'
import { GOAL_LABEL, POSITION_LABEL, type Goal, type BoothPosition } from '@/lib/tenjikai/engine'

type Phase = SavedDetailPhase | 'invalid_project'

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch { return null }
}

const savedLabel = (value: string | undefined, labels: Record<string, string>) => value && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : '保存された値を確認できません。'

export default function SavedProjectPartialView({ phase, detail, section, onReload, loginCallbackUrl, newProjectHref = '/tenjikai' }: {
  phase: Phase
  detail: ProjectDetailResponse | null
  section: Section
  onReload: () => void
  loginCallbackUrl: string
  newProjectHref?: string
}) {
  const messages: Record<Exclude<Phase, 'ready_partial'>, string> = {
    checking_auth: 'ログイン状態を確認しています。',
    loading: '保存内容を読み込んでいます。',
    not_found: 'この案件を表示できません。URLとログイン中のアカウントをご確認ください。',
    error: '保存内容を読み込めませんでした。再度お試しください。',
    unauthenticated: '保存内容を確認するには、ログインしてください。',
    auth_changed: 'ログイン状態が変わりました。確認後に再読み込みしてください。',
    invalid_project: '案件の指定が正しくありません。URLをご確認ください。',
  }
  const ready = phase === 'ready_partial' ? detail : null
  const project = ready?.project
  const analysis = ready?.analysis
  const website = project ? safeHttpUrl(project.serviceUrl) : null
  const logoHref = analysis?.state === 'saved' && analysis.value.logoUrl ? safeHttpUrl(analysis.value.logoUrl) : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-ink md:px-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold">保存内容の確認</h2>
        <p className="text-sm text-[var(--sub)]">保存されている入力内容と分析結果を表示しています。この画面では編集・保存はできません。</p>
      </header>

      {!ready ? (
        <div role="status" className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5">
          <p>{messages[phase === 'ready_partial' ? 'error' : phase]}</p>
          {(phase === 'loading' || phase === 'error' || phase === 'not_found' || phase === 'auth_changed' || phase === 'unauthenticated') && (
            <button type="button" onClick={onReload} className="mt-4 rounded-[var(--r-sm)] bg-[var(--blue-deep)] px-4 py-2 text-sm font-semibold text-white">再読み込み</button>
          )}
          {phase === 'unauthenticated' && (
            <Link className="ml-3 text-sm font-semibold text-[var(--blue-deep)] underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`}>ログイン</Link>
          )}
        </div>
      ) : (
        <>
          {section !== 'overview' && (
            <p className="rounded-[var(--r-sm)] border border-[var(--blue-line)] bg-[var(--blue-soft)] p-4 text-sm text-[var(--ink)]">この項目の保存内容は、まだ表示に対応していません。以下で入力内容と分析結果を確認できます。</p>
          )}
          <section aria-label="保存された入力内容" className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5">
            <h3 className="text-lg font-bold">出展条件</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-[var(--sub)]">保存名</dt><dd>{project?.projectName}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">展示会名</dt><dd>{project?.eventName}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">会期開始日</dt><dd>{project?.eventDate}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">会期日数</dt><dd>{project?.eventDays}日</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">会場ID</dt><dd>{project?.venueId ?? '会場情報は確認できません。'}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">小間数</dt><dd>{project?.komaCols}列 × {project?.komaRows}行</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">ブース寸法</dt><dd>{project?.boothWidthM}m × {project?.boothDepthM}m</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">ブース位置</dt><dd>{savedLabel(project?.boothPosition, POSITION_LABEL satisfies Record<BoothPosition, string>)}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">入力予算</dt><dd>{project?.budgetYen.toLocaleString('ja-JP')}円</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">目的</dt><dd>{savedLabel(project?.goal, GOAL_LABEL satisfies Record<Goal, string>)}</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">担当人数</dt><dd>{project?.staffCount}人</dd></div>
              <div><dt className="text-sm text-[var(--sub)]">サービスURL</dt><dd className="break-all">{website ? <a href={website} target="_blank" rel="noopener noreferrer" className="text-[var(--blue-deep)] underline">{project?.serviceUrl}</a> : project?.serviceUrl}</dd></div>
            </dl>
          </section>
          <section aria-label="保存された分析結果" className="rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-5">
            <h3 className="text-lg font-bold">分析結果</h3>
            {analysis?.state === 'missing' ? <p className="mt-3">保存された分析結果はありません。</p>
              : analysis?.state === 'invalid' ? <p className="mt-3">保存された分析結果を表示できません。</p>
              : analysis?.state === 'saved' ? (
                <div className="mt-4 space-y-4">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-sm text-[var(--sub)]">ブランド</dt><dd>{analysis.value.brand}</dd></div>
                    <div><dt className="text-sm text-[var(--sub)]">カテゴリ</dt><dd>{analysis.value.category}</dd></div>
                    <div><dt className="text-sm text-[var(--sub)]">見出し</dt><dd>{analysis.value.headline}</dd></div>
                    <div><dt className="text-sm text-[var(--sub)]">補足</dt><dd>{analysis.value.subline}</dd></div>
                    <div><dt className="text-sm text-[var(--sub)]">文体</dt><dd>{analysis.value.tone}</dd></div>
                    <div><dt className="text-sm text-[var(--sub)]">配色</dt><dd>{[analysis.value.colors.primary, analysis.value.colors.secondary, analysis.value.colors.accent].join(' / ')}</dd></div>
                    {analysis.value.logoUrl && <div><dt className="text-sm text-[var(--sub)]">ロゴURL</dt><dd className="break-all">{logoHref ? <a href={logoHref} target="_blank" rel="noopener noreferrer" className="text-[var(--blue-deep)] underline">{analysis.value.logoUrl}</a> : analysis.value.logoUrl}</dd></div>}
                  </dl>
                  <div><h4 className="font-semibold">訴求点</h4>{analysis.value.valueProps.length ? <ul className="list-disc pl-5">{analysis.value.valueProps.map((item, index) => <li key={index}>{item.title}：{item.body}</li>)}</ul> : <p>保存された訴求点は0件です。</p>}</div>
                  <div><h4 className="font-semibold">対象</h4>{analysis.value.targets.length ? <ul className="list-disc pl-5">{analysis.value.targets.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>保存された対象は0件です。</p>}</div>
                </div>
              ) : null}
          </section>
          <p className="rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm text-[var(--sub)]">ブース案・制作物・ノベルティ・予算内訳・資料・締切は、この画面では確認できません。</p>
          <button type="button" onClick={onReload} className="rounded-[var(--r-sm)] border border-[var(--blue-deep)] px-4 py-2 text-sm font-semibold text-[var(--blue-deep)]">再読み込み</button>
        </>
      )}
      <Link href={newProjectHref} className="inline-block text-sm font-semibold text-[var(--blue-deep)] underline">新規出展プロジェクト</Link>
    </div>
  )
}
