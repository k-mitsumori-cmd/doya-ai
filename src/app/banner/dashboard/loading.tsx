export default function BannerDashboardLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* サイドバー（PC） */}
      <div className="hidden md:block w-[240px] bg-gray-950 border-r border-gray-800/50 flex-shrink-0">
        <div className="p-4 space-y-4">
          <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 bg-gray-800/60 rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 min-h-screen bg-black overflow-hidden">
        {/* モバイルヘッダー */}
        <div className="md:hidden h-12 bg-black/90 border-b border-gray-800 flex items-center justify-between px-3">
          <div className="w-9 h-9 bg-gray-800 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="w-9" />
        </div>

        {/* ヒーロー画像エリア（スケルトン） */}
        <div className="relative h-[32vh] sm:h-[40vh] md:h-[50vh] lg:h-[55vh] bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
          {/* シマーアニメーション */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-800/30 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />
          {/* ヒーロー上のテキストスケルトン */}
          <div className="absolute bottom-6 left-4 sm:left-8 z-20 space-y-3">
            <div className="h-4 w-20 bg-gray-700/60 rounded animate-pulse" />
            <div className="h-8 sm:h-10 w-48 sm:w-72 bg-gray-700/40 rounded animate-pulse" />
            <div className="h-4 w-64 sm:w-96 bg-gray-700/30 rounded animate-pulse" />
            <div className="flex gap-2 mt-4">
              <div className="h-10 w-40 bg-blue-600/30 rounded-xl animate-pulse" />
              <div className="h-10 w-28 bg-gray-800/60 rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        {/* フィルタータブ（スケルトン） */}
        <div className="bg-black/90 border-b border-gray-800/50 px-2 sm:px-4 md:px-8 lg:px-12 py-2 flex gap-1 overflow-hidden">
          {[80, 64, 56, 72, 64, 48, 72, 56].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-gray-800/60 animate-pulse flex-shrink-0"
              style={{ width: `${w}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>

        {/* テンプレートグリッド（スケルトン） */}
        <div className="px-1 sm:px-2 md:px-4 lg:px-8 py-2">
          {[1, 2, 3].map((section) => (
            <div key={section} className="mb-3">
              {/* カテゴリ名 */}
              <div className="flex items-center gap-1.5 px-1 sm:px-2 py-1.5">
                <div className="w-2 h-2 bg-blue-400/40 rounded-sm animate-pulse" />
                <div className="h-3.5 w-24 bg-gray-700/40 rounded animate-pulse" style={{ animationDelay: `${section * 150}ms` }} />
              </div>
              {/* グリッド */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[16/10] rounded bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden relative"
                  >
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/20 to-transparent animate-[shimmer_2s_infinite]"
                      style={{ backgroundSize: '200% 100%', animationDelay: `${(section * 4 + i) * 100}ms` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
