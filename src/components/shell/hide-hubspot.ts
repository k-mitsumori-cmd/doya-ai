// ============================================
// アプリの画面では HubSpot のポップアップを出さない
// ============================================
// HubSpot のポップアップ（GTM から全ページに出る。「その疑問、AIに聞いてみよう。」など）は、
// 375px でアプリの画面の下を覆い、下のタブまで隠していた（統括の確認 2026-10-19）。
// GTM と HubSpot の設定はこちらから変えられないので、共通の枠（AppShell）と会社情報の画面の中だけ CSS で隠す。
// ⚠️ LP（ログインしていない人の画面）は共通の枠の外なので、今までどおり出る。
export const HIDE_HUBSPOT_CSS =
  '[id^="hs-web-interactives"],[class*="hs-web-interactive"],#hubspot-messages-iframe-container,.hs-overlay-container,.leadinModal,.leadinModal-overlay{display:none!important}'
