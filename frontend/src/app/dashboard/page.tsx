import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatSyncDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Nunca'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [
    { count: totalProducts },
    { count: activeProducts },
    alertasResult,
    lastProductSyncResult,
    lastCompetitorSyncResult,
  ] = await Promise.all([
    admin.from('ml_products').select('*', { count: 'exact', head: true }),
    admin.from('ml_products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('price_alerts').select('*', { count: 'exact', head: true }),
    admin.from('ml_products').select('synced_at').order('synced_at', { ascending: false }).limit(1).single(),
    admin.from('ml_competitor_items').select('synced_at').order('synced_at', { ascending: false }).limit(1).single(),
  ])
  const totalAlertas = alertasResult.error ? null : alertasResult.count
  const lastProductSync = lastProductSyncResult.data?.synced_at ?? null
  const lastCompetitorSync = lastCompetitorSyncResult.data?.synced_at ?? null

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

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Última sincronización</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SyncCard
            title="Productos propios"
            description="ml-sync · cada 2 horas"
            lastSync={formatSyncDate(lastProductSync)}
          />
          <SyncCard
            title="Productos de la competencia"
            description="ml-sync-competitor · cada 2 horas"
            lastSync={formatSyncDate(lastCompetitorSync)}
          />
        </div>
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

function SyncCard({ title, description, lastSync }: { title: string; description: string; lastSync: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
      <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-green-400" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="ml-auto text-right shrink-0">
        <p className="text-xs text-gray-500 font-medium">{lastSync}</p>
      </div>
    </div>
  )
}
