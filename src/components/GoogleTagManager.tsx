'use client'

import Script from 'next/script'

interface GoogleTagManagerProps {
  gtmId?: string | null
}

export function GoogleTagManager({ gtmId }: GoogleTagManagerProps) {
  // propsで渡されたGTM ID、または環境変数から取得
  const id = gtmId || process.env.NEXT_PUBLIC_GTM_ID

  if (!id) {
    return null
  }

  return (
    <>
      {/* Google Tag Manager - Script */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${id}');
          `,
        }}
      />
    </>
  )
}

interface GoogleTagManagerNoScriptProps {
  gtmId?: string | null
}

export function GoogleTagManagerNoScript({ gtmId }: GoogleTagManagerNoScriptProps) {
  // propsで渡されたGTM ID、または環境変数から取得
  const id = gtmId || process.env.NEXT_PUBLIC_GTM_ID

  if (!id) {
    return null
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  )
}

