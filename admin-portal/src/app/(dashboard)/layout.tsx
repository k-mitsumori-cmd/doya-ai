import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authenticated = await isAuthenticated()
  
  if (!authenticated) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="ml-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}

