'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getProjectByPath, type ProjectView } from '@/lib/projects'
import BrandLogo from '@/components/BrandLogo'
import type React from 'react'

type IconProps = { className?: string }

const HomeIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
  </svg>
)
const BoxIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)
const BellIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
  </svg>
)
const TrendIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
  </svg>
)
const UsersIcon = ({ className }: IconProps) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87a4 4 0 10-6 0M16 3.13a4 4 0 010 7.75M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)
const iconMap: Record<ProjectView['icon'], (props: IconProps) => React.ReactNode> = {
  home: HomeIcon,
  box: BoxIcon,
  bell: BellIcon,
  trend: TrendIcon,
  users: UsersIcon,
}

export default function Sidebar() {
  const pathname = usePathname()
  const project = getProjectByPath(pathname)

  return (
    <aside className="w-full bg-white border-b border-[rgba(185,11,8,0.10)] flex flex-col shrink-0 shadow-[0_1px_0_rgba(185,11,8,0.04)] lg:w-[300px] lg:border-b-0 lg:border-r lg:shadow-[1px_0_0_rgba(185,11,8,0.04)]">
      <div className="p-4">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#000000] p-4 text-white shadow-[0_18px_40px_rgba(10,10,10,0.22)] lg:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <BrandLogo />
              <p className="mt-4 text-[11px] uppercase tracking-[0.38em] text-white/58 lg:mt-5">Eurotech Gestor</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/78">
              Uruguay
            </div>
          </div>

          <div className="mt-6 lg:mt-7">
            <p className="text-3xl font-semibold tracking-tight text-white">Super-admin</p>
            <p className="mt-2 max-w-[14rem] text-sm leading-6 text-white/72">Vista consolidada y gestion de accesos.</p>
          </div>
        </div>
      </div>

      <div className="mx-5 my-1 h-px bg-[rgba(185,11,8,0.08)]" />

      <nav className="flex-1 px-3 py-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1 lg:gap-0 lg:space-y-1">
        {project.views.map(({ href, label, icon }) => {
          const Icon = iconMap[icon]
          const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition-colors lg:px-4 ${
                isActive
                  ? 'bg-[rgba(185,11,8,0.08)] text-[var(--brand-800)] shadow-[inset_0_0_0_1px_rgba(185,11,8,0.08)]'
                  : 'text-[rgba(42,31,29,0.70)] hover:bg-[rgba(185,11,8,0.04)] hover:text-[var(--brand-900)]'
              }`}
            >
              {isActive && (
                <span className="absolute left-2 top-2.5 bottom-2.5 w-1 rounded-full bg-[linear-gradient(180deg,#B90B08_0%,#D93A34_100%)]" />
              )}
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[var(--brand-700)]' : 'text-[rgba(42,31,29,0.35)] group-hover:text-[rgba(42,31,29,0.56)]'}`} />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 pb-5 pt-3">
        <div className="rounded-2xl border border-[rgba(185,11,8,0.08)] bg-[rgba(185,11,8,0.04)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[rgba(185,11,8,0.62)]">Marca</p>
          <p className="mt-1 text-sm font-medium text-[var(--brand-900)]">{project.name}</p>
        </div>
      </div>
    </aside>
  )
}
