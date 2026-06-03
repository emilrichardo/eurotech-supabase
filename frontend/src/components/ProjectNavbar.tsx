'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getProjectByPath, projects } from '@/lib/projects'
import type { User } from '@supabase/supabase-js'

type IconProps = { className?: string }

const ChevronDownIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 9l6 6 6-6" />
  </svg>
)

const LogoutIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H9m0-8H5a2 2 0 00-2 2v12a2 2 0 002 2h4" />
  </svg>
)

export default function ProjectNavbar({ user }: { user: User }) {
  const pathname = usePathname()
  const router = useRouter()
  const activeProject = getProjectByPath(pathname)
  const initial = (user.email ?? '?').charAt(0).toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleProjectChange(projectId: string) {
    const project = projects.find(item => item.id === projectId)
    if (project) router.push(project.basePath)
  }

  return (
    <header className="h-18 border-b border-[rgba(57,0,148,0.12)] bg-[rgba(255,255,255,0.88)] backdrop-blur supports-[backdrop-filter]:bg-white/78 flex items-center justify-between px-6 lg:px-8 shrink-0">
      <div className="flex items-start gap-4 min-w-0">
        <div className="min-w-0">
          <p className="text-[11px] text-[rgba(57,0,148,0.55)] uppercase tracking-[0.3em] leading-none mb-1">{activeProject.eyebrow}</p>
          <div className="relative w-56 max-w-[52vw]">
            <select
              value={activeProject.id}
              onChange={event => handleProjectChange(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-[rgba(57,0,148,0.10)] bg-white px-4 py-2.5 pr-10 text-[1.05rem] font-semibold tracking-tight text-[var(--brand-900)] outline-none transition-colors hover:border-[rgba(57,0,148,0.24)] focus:border-[rgba(57,0,148,0.38)] focus:bg-white focus:ring-2 focus:ring-[rgba(57,0,148,0.12)] shadow-[0_12px_26px_rgba(57,0,148,0.06)]"
              aria-label="Seleccionar proyecto"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(57,0,148,0.42)]" />
          </div>
          <p className="mt-1 text-sm text-[rgba(29,8,74,0.58)]">Vista global del panel operativo</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-[rgba(57,0,148,0.12)] bg-white px-3 py-1.5 min-w-0 shadow-[0_10px_24px_rgba(57,0,148,0.06)]">
          <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,#390094_0%,#6A3FB9_100%)] text-white font-semibold text-xs flex items-center justify-center shrink-0">
            {initial}
          </div>
          <p className="text-xs text-[rgba(29,8,74,0.72)] truncate max-w-48">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full text-[rgba(57,0,148,0.62)] hover:text-[#390094] hover:bg-[rgba(57,0,148,0.08)] transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogoutIcon className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  )
}
