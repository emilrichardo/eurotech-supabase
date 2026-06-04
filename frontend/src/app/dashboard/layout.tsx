import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    <div className="min-h-screen bg-transparent lg:h-[100dvh] lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:h-full lg:min-h-0 lg:flex-row lg:gap-5 lg:px-5 lg:py-5">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="min-h-full rounded-[1.75rem] border border-[rgba(185,11,8,0.10)] bg-[rgba(255,255,255,0.72)] shadow-[0_24px_60px_rgba(42,31,29,0.08)] backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
