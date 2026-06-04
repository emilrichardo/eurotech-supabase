import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProjectNavbar from '@/components/ProjectNavbar'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent lg:h-screen lg:overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <ProjectNavbar user={user} />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <Sidebar />
          <main className="flex-1 overflow-visible lg:overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
