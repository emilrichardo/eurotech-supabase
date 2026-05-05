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

function freshness(dateStr: string | null | undefined): 'fresh' | 'stale' | 'never' {
  if (!dateStr) return 'never'
  const age = Date.now() - new Date(dateStr).getTime()
  return age < 3 * 60 * 60 * 1000 ? 'fresh' : 'stale'
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
    admin.schema('ml').from('ml_products').select('*', { count: 'exact', head: true }),
    admin.schema('ml').from('ml_products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.schema('ml').from('ml_price_alerts').select('*', { count: 'exact', head: true }),
    admin.schema('ml').from('ml_products').select('synced_at').order('synced_at', { ascending: false }).limit(1).single(),
    admin.schema('ml').from('ml_competitor_items').select('synced_at').order('synced_at', { ascending: false }).limit(1).single(),
  ])
  const totalAlertas = alertasResult.error ? null : alertasResult.count
  const lastProductSync = lastProductSyncResult.data?.synced_at ?? null
  const lastCompetitorSync = lastCompetitorSyncResult.data?.synced_at ?? null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bienvenido, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total publicaciones"
          value={totalProducts != null ? String(totalProducts) : '—'}
          description="En MercadoLibre"
          tone="neutral"
        />
        <StatCard
          label="Publicaciones activas"
          value={activeProducts != null ? String(activeProducts) : '—'}
          description="Con stock disponible"
          tone="green"
        />
        <StatCard
          label="Alertas de precio"
          value={totalAlertas != null ? String(totalAlertas) : '—'}
          description="Configuradas"
          tone="blue"
        />
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Última sincronización</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SyncCard
            title="Productos propios"
            description="ml-sync · cada 2 horas"
            lastSync={formatSyncDate(lastProductSync)}
            status={freshness(lastProductSync)}
          />
          <SyncCard
            title="Productos de la competencia"
            description="ml-sync-competitor · cada 2 horas"
            lastSync={formatSyncDate(lastCompetitorSync)}
            status={freshness(lastCompetitorSync)}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, description, tone }: { label: string; value: string; description: string; tone: 'neutral' | 'green' | 'blue' }) {
  const valueColor = { neutral: 'text-gray-900', green: 'text-green-600', blue: 'text-blue-600' }[tone]
  const dotColor = { neutral: 'bg-gray-300', green: 'bg-green-400', blue: 'bg-blue-400' }[tone]
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-3xl font-bold ${valueColor} leading-none`}>{value}</p>
      <p className="text-xs text-gray-400 mt-2">{description}</p>
    </div>
  )
}

function SyncCard({ title, description, lastSync, status }: { title: string; description: string; lastSync: string; status: 'fresh' | 'stale' | 'never' }) {
  const dotColor = { fresh: 'bg-green-400', stale: 'bg-amber-400', never: 'bg-gray-300' }[status]
  const dotAnim = status === 'fresh' ? 'animate-pulse' : ''
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
      <div className="relative shrink-0">
        <span className={`block w-2.5 h-2.5 rounded-full ${dotColor} ${dotAnim}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-600 font-medium">{lastSync}</p>
      </div>
    </div>
  )
}
