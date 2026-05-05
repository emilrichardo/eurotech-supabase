export type ProjectId = 'ml-monitor'

export type ProjectView = {
  href: string
  label: string
  icon: 'home' | 'box' | 'bell' | 'trend' | 'users'
}

export type ProjectConfig = {
  id: ProjectId
  name: string
  shortName: string
  eyebrow: string
  basePath: string
  accent: string
  views: ProjectView[]
}

export const projects: ProjectConfig[] = [
  {
    id: 'ml-monitor',
    name: 'ML Monitor',
    shortName: 'ML',
    eyebrow: 'MercadoLibre',
    basePath: '/dashboard',
    accent: 'from-blue-500 to-cyan-500',
    views: [
      { href: '/dashboard', label: 'Inicio', icon: 'home' },
      { href: '/dashboard/productos', label: 'Productos', icon: 'box' },
      { href: '/dashboard/alertas', label: 'Alertas de precio', icon: 'bell' },
      { href: '/dashboard/seguimiento', label: 'Seguimiento', icon: 'trend' },
      { href: '/dashboard/usuarios', label: 'Usuarios', icon: 'users' },
    ],
  },
]

export function getProjectByPath(pathname: string): ProjectConfig {
  return (
    projects
      .filter(project => pathname === project.basePath || pathname.startsWith(`${project.basePath}/`))
      .sort((a, b) => b.basePath.length - a.basePath.length)[0] ?? projects[0]
  )
}
