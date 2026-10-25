'use client'
// 開発用の確認ページの中身。知らせの部品を1つずつ出せる（本番では page.tsx が 404 にする）
import toast from 'react-hot-toast'
import { useNotice } from '@/components/notice/NoticeProvider'
import { seenKey } from '@/lib/notice/seen'

export default function NoticePreviewBody() {
  const n = useNotice()
  const btn = { minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid #e3e9f3', background: '#fff', cursor: 'pointer', fontWeight: 700 } as const
  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 120px', display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>ドヤくんの知らせ（開発用の確認ページ）</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" style={btn} onClick={() => n.notify({ title: '保存しました', sub: '粗利率 35%', action: { label: '取り消す', onClick: () => n.notify({ tone: 'info', title: '保存を取り消しました', durationMs: 3000 }) } })}>保存のトースト</button>
        <button type="button" style={btn} onClick={() => n.notify({ tone: 'error', title: '見積書を作れませんでした', sub: '金額が空の品目があります', action: { label: '直す', onClick: () => {} } })}>失敗のトースト</button>
        <button type="button" style={btn} onClick={() => n.push({ id: 'preview:error', kind: 'error', tone: 'error', pose: 'error', eyebrow: 'うまく作れませんでした', title: '見積書を作れませんでした', body: '品目の金額が空のままです。金額を入れてから、もう一度作ってください。ドヤパワーは減っていません。', primary: { label: '金額を入れる' }, secondary: { label: '閉じる' } })}>エラーのシート</button>
        <button type="button" style={btn} onClick={() => n.push({ id: 'preview:approval', kind: 'approval', pose: 'point', eyebrow: '承認待ち', title: '佐藤さんの見積書が、承認を待っています', body: 'Webサイトの制作・税抜 930,000 円。', primary: { label: '内容を見る' }, secondary: { label: 'あとで', done: false } })}>承認待ちのシート</button>
        <button type="button" style={btn} onClick={(e) => n.tip(e.currentTarget, { id: 'preview:tip', title: '粗利率', body: '売上から原価を引いた額が、売上のうち何割かを表します。' })}>吹き出し</button>
        <button type="button" style={btn} onClick={() => { const release = n.holdBusy(); n.notify({ tone: 'info', title: '作業中にしました（5秒）', durationMs: 5000 }); setTimeout(release, 5000) }}>5秒だけ作業中</button>
        <button type="button" style={btn} onClick={() => toast.success('コピーしました')}>今のトースト（成功）</button>
        <button type="button" style={btn} onClick={() => toast.error('保存に失敗しました。もう一度お試しください。')}>今のトースト（失敗）</button>
        <button type="button" style={btn} onClick={() => { const id = toast.loading('作っています…'); setTimeout(() => toast.success('できました', { id }), 2500) }}>今のトースト（作成中）</button>
        <button type="button" style={btn} onClick={() => { try { localStorage.removeItem(seenKey('preview')) } catch {} location.reload() }}>見た記録を消して開き直す</button>
      </div>
      <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 700 }}>入力欄（ここに入ると作業中になり、知らせを待たせます）
        <input style={{ minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid #e3e9f3' }} defaultValue="35%" />
      </label>
    </div>
  )
}
