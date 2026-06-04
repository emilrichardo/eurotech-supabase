'use client'

import { usePathname } from 'next/navigation'
import { getProjectByPath } from '@/lib/projects'
import type { User } from '@supabase/supabase-js'

export default function ProjectNavbar({ user }: { user: User }) {
  const pathname = usePathname()
  const activeProject = getProjectByPath(pathname)
  const initial = (user.email ?? '?').charAt(0).toUpperCase()

  return (
    <header className="border-b border-[rgba(185,11,8,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,240,239,0.95)),radial-gradient(circle_at_50%_0%,rgba(185,11,8,0.10),rgba(0,0,0,0)_30%)] backdrop-blur supports-[backdrop-filter]:bg-white/78 px-4 py-3 sm:px-6 lg:px-8 shrink-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] uppercase leading-none tracking-[0.3em] text-[rgba(185,11,8,0.64)]">{activeProject.eyebrow}</p>
            <div className="rounded-2xl border border-[rgba(185,11,8,0.12)] bg-white px-4 py-3 shadow-[0_12px_26px_rgba(185,11,8,0.05)]">
              <p className="text-[1.05rem] font-semibold tracking-tight text-[var(--brand-900)]">{activeProject.name}</p>
              <p className="mt-1 text-sm text-[rgba(42,31,29,0.58)]">Vista global del panel operativo</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2.5 min-w-0 lg:justify-end">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-[rgba(185,11,8,0.12)] bg-white px-3 py-1.5 min-w-0 shadow-[0_10px_24px_rgba(185,11,8,0.06)]">
            <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,#B90B08_0%,#D93A34_100%)] text-white font-semibold text-xs flex items-center justify-center shrink-0">
              {initial}
            </div>
            <p className="text-xs text-[rgba(42,31,29,0.72)] truncate max-w-48">{user.email}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
