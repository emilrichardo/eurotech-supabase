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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="flex min-w-0 flex-1 flex-col">
        <ProjectNavbar user={user} />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
