/**
 * /seo/template 専用レイアウト
 * 親レイアウト（SeoAppLayout）のpadding/max-widthを打ち消す
 */
export default function SeoTemplateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-m-4 sm:-m-6 md:-m-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] md:w-[calc(100%+4rem)]">
      {children}
    </div>
  )
}
