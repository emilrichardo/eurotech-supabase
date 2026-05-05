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
    <header className="h-16 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 flex items-center justify-between px-5 lg:px-7 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg bg-linear-to-br ${activeProject.accent} text-white font-bold text-xs flex items-center justify-center shadow-sm`}>
          {activeProject.shortName}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-1">Eurotech</p>
          <div className="relative w-52 max-w-[52vw]">
            <select
              value={activeProject.id}
              onChange={event => handleProjectChange(event.target.value)}
              className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 pr-8 text-sm font-semibold text-gray-900 outline-none transition-colors hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              aria-label="Seleccionar proyecto"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 min-w-0">
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-semibold text-xs flex items-center justify-center shrink-0">
            {initial}
          </div>
          <p className="text-xs text-gray-500 truncate max-w-48">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogoutIcon className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  )
}
