import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ count: totalProducts }, { count: activeProducts }, alertasResult] = await Promise.all([
    admin.from('ml_products').select('*', { count: 'exact', head: true }),
    admin.from('ml_products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('price_alerts').select('*', { count: 'exact', head: true }),
  ])
  const totalAlertas = alertasResult.error ? null : alertasResult.count

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Bienvenido, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total publicaciones"
          value={totalProducts != null ? String(totalProducts) : '—'}
          description="En MercadoLibre"
        />
        <StatCard
          title="Publicaciones activas"
          value={activeProducts != null ? String(activeProducts) : '—'}
          description="Con stock disponible"
        />
        <StatCard
          title="Alertas de precio"
          value={totalAlertas != null ? String(totalAlertas) : '—'}
          description="Configuradas"
        />
      </div>
    </div>
  )
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  )
}
