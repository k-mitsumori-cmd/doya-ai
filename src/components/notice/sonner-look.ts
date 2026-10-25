// ============================================
// sonner（プロマネだけが使う）のトーストを、ドヤくんの知らせのトーストと同じ見た目にする設定（提案リスト (17)）
// ============================================
// 下のまん中・濃い地に白い文字・角の丸み 14px。スマホは下のタブ（約 68px）の上に出す。
// ⚠️ 旗（GUIDE_POPUPS_ROLLOUT）が出すと決めた人のときだけ使う（PromaneShellFrame が useNotice().enabled を見る）。
import type { ToasterProps } from 'sonner'

export const SONNER_NOTICE_PROPS: ToasterProps = {
  position: 'bottom-center',
  closeButton: true,
  visibleToasts: 1,
  offset: 24,
  mobileOffset: { bottom: 80 },
  toastOptions: {
    style: {
      background: '#0b1b33', color: '#ffffff', border: 0, borderRadius: '14px', fontSize: '14px', fontWeight: 700,
      boxShadow: '0 2px 6px rgba(11, 27, 51, .08), 0 18px 48px rgba(11, 27, 51, .16)',
    },
  },
}
