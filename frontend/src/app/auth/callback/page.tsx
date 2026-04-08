'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Verificando sesión...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const hash = window.location.hash

    if (!hash || !hash.includes('access_token')) {
      setError('No se encontró un token válido en la URL.')
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token') ?? ''
    const type = params.get('type')

    if (!access_token) {
      setError('Token inválido.')
      return
    }

    setStatus('Iniciando sesión...')

    supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
      if (error) {
        setError(`Error: ${error.message}`)
        return
      }

      if (type === 'invite' || type === 'recovery') {
        setStatus('Redirigiendo para establecer contraseña...')
        router.push('/auth/update-password')
      } else if (data.session) {
        setStatus('Sesión iniciada. Redirigiendo...')
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('No se pudo establecer la sesión.')
      }
    })
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium mb-2">Error de autenticación</p>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a
            href="/login"
            className="text-blue-600 hover:underline text-sm"
          >
            Volver al login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 text-sm">{status}</p>
      </div>
    </div>
  )
}
