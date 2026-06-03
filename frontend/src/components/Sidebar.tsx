'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { getProjectByPath, type ProjectView } from '@/lib/projects'
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
    <aside className="w-[300px] bg-white border-r border-[rgba(57,0,148,0.10)] flex flex-col shrink-0 shadow-[1px_0_0_rgba(57,0,148,0.04)]">
      <div className="p-4">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#0A0A0A] p-5 text-white shadow-[0_18px_40px_rgba(10,10,10,0.22)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Image
                src="/eurotech-logo.svg"
                alt="Eurotech"
                width={160}
                height={28}
                className="h-auto w-[160px] brightness-125 contrast-125 saturate-125"
                priority
              />
              <p className="mt-5 text-[11px] uppercase tracking-[0.38em] text-white/58">Eurotech Monitor</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/78">
              Uruguay
            </div>
          </div>

          <div className="mt-7">
            <p className="text-3xl font-semibold tracking-tight text-white">Gestión interna</p>
            <p className="mt-2 max-w-[14rem] text-sm leading-6 text-white/72">Monitoreo operativo por tienda, productos y competencia.</p>
          </div>
        </div>
      </div>

      <div className="mx-5 my-1 h-px bg-[rgba(57,0,148,0.08)]" />

      <nav className="flex-1 px-3 py-4 space-y-1">
        {project.views.map(({ href, label, icon }) => {
          const Icon = iconMap[icon]
          const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[rgba(57,0,148,0.08)] text-[var(--brand-800)] shadow-[inset_0_0_0_1px_rgba(57,0,148,0.08)]'
                  : 'text-[rgba(29,8,74,0.70)] hover:bg-[rgba(57,0,148,0.04)] hover:text-[var(--brand-900)]'
              }`}
            >
              {isActive && (
                <span className="absolute left-2 top-2.5 bottom-2.5 w-1 rounded-full bg-[linear-gradient(180deg,#390094_0%,#6A3FB9_100%)]" />
              )}
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[var(--brand-700)]' : 'text-[rgba(29,8,74,0.35)] group-hover:text-[rgba(29,8,74,0.56)]'}`} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-5 pb-5 pt-3">
        <div className="rounded-2xl border border-[rgba(57,0,148,0.08)] bg-[rgba(57,0,148,0.04)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[rgba(57,0,148,0.62)]">Marca</p>
          <p className="mt-1 text-sm font-medium text-[var(--brand-900)]">{project.name}</p>
        </div>
      </div>
    </aside>
  )
}
