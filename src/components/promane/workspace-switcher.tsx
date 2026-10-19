import Link from "next/link";
import { Building2 } from "lucide-react";

// ワークスペースの切り替え（入口のワークスペース選択へ戻る）。サイドバーの同名のリンクと同じ遷移先
export function WorkspaceSwitcher() {
  return (
    <Link
      href="/promane?select=1"
      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-50 to-violet-50 hover:from-blue-100 hover:to-violet-100 px-3 py-1.5 text-[12px] font-black text-gray-700 hover:text-blue-700 transition-all"
    >
      <Building2 size={14} aria-hidden />
      ワークスペース切替
    </Link>
  );
}
