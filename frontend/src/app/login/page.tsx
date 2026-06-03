'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BrandLogo from '@/components/BrandLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingHash, setCheckingHash] = useState(true)

  // Handle token in URL hash (invite links, magic links, etc.)
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      // Redirect to auth/callback to process the token
      router.replace('/auth/callback' + hash)
      return
    }
    setCheckingHash(false)
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  if (checkingHash) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-800)]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[rgba(57,0,148,0.12)] bg-[rgba(255,255,255,0.72)] shadow-[0_30px_90px_rgba(57,0,148,0.12)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-[linear-gradient(160deg,#1D084A_0%,#390094_46%,#6A3FB9_100%)] px-8 py-10 text-white lg:px-12 lg:py-14">
          <div className="absolute inset-0 opacity-35">
            <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute right-0 top-28 h-72 w-72 rounded-full bg-[#A184CF]/30 blur-3xl" />
            <div className="absolute -bottom-8 left-1/3 h-64 w-64 rounded-full bg-[#6A3FB9]/35 blur-3xl" />
          </div>

          <div className="relative flex h-full flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <BrandLogo compact className="shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">Eurotech</p>
                  <p className="text-xs text-white/90">Monitor</p>
                </div>
              </div>
              <div className="max-w-xl space-y-5">
                <p className="text-[11px] uppercase tracking-[0.32em] text-white/70">Eurotech Monitor</p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  Un panel más claro para ver productos, alertas y competencia.
                </h1>
                <p className="max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                  Una identidad más consistente con Eurotech, con un acceso visual más limpio y una jerarquía fuerte para la operación diaria.
                </p>
              </div>
            </div>

            <div className="grid gap-3 pt-12 sm:grid-cols-3">
              {[
                ['Productos', 'Carga más rápida y progresiva'],
                ['Alertas', 'Menos fricción visual'],
                ['Sync', 'Más estabilidad y velocidad'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-[1.75rem] border border-[rgba(57,0,148,0.12)] bg-white/90 p-8 shadow-[0_20px_60px_rgba(57,0,148,0.09)]">
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-full border border-[rgba(57,0,148,0.12)] bg-[rgba(57,0,148,0.05)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand-800)]">
                    Acceso seguro
                  </div>
                  <Image src="/eurotech-logo.svg" alt="Eurotech" width={136} height={24} className="h-auto w-[136px]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--brand-900)]">Iniciar sesión</h2>
                  <p className="mt-1 text-sm text-[rgba(29,8,74,0.62)]">Ingresá para revisar productos, alertas y sincronización.</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[rgba(29,8,74,0.75)]">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[rgba(57,0,148,0.14)] bg-white px-4 py-3 text-sm text-[var(--brand-900)] placeholder:text-[rgba(29,8,74,0.35)] outline-none transition focus:border-[rgba(57,0,148,0.4)] focus:ring-4 focus:ring-[rgba(57,0,148,0.1)]"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[rgba(29,8,74,0.75)]">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-[rgba(57,0,148,0.14)] bg-white px-4 py-3 text-sm text-[var(--brand-900)] placeholder:text-[rgba(29,8,74,0.35)] outline-none transition focus:border-[rgba(57,0,148,0.4)] focus:ring-4 focus:ring-[rgba(57,0,148,0.1)]"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-[linear-gradient(135deg,#390094_0%,#6A3FB9_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(57,0,148,0.22)] transition hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
