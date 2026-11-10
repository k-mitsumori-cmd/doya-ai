'use client'
// ============================================
// ds/DoyaToaster — トースト（react-hot-toast）の置き場。弾んで出て、消えるときは縮んで薄くなる
// ============================================
// 設定はここ1か所。ルートの layout.tsx から置く。
// - 動きの定義は app-motion.css（.m-toast-in / .m-toast-out）。この CSS は共通の枠（AppShell）を開いている間だけ読み込まれる
//   → 枠の外（LP・管理画面）では何も効かず、react-hot-toast の元の動きのまま
// - 動きを減らす設定では CSS が止める（出る・消えるはそのまま、動きだけ無し）
// - ⚠️ 文言・長さ・見た目（背景・影・角丸）は変えない。変えるのは出入りの動きだけ
import { Toaster, ToastBar } from 'react-hot-toast'

export default function DoyaToaster() {
  return (
    <Toaster
      containerClassName="doya-hot-toaster"
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#333',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
          padding: '16px',
        },
      }}
    >
      {(t) => (
        // ToastBar 自体には class を付けられないので、外側の1枚に動きを付ける（CSS が元の動きを止める）
        <div className={t.visible ? 'm-toast-in' : 'm-toast-out'}><ToastBar toast={t} /></div>
      )}
    </Toaster>
  )
}
