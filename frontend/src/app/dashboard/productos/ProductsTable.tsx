'use client'

import { useState } from 'react'
import Image from 'next/image'

function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-gray-400 text-lg leading-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

type Product = {
  id: string
  title: string
  subtitle: string | null
  sku: string | null
  price: number | null
  base_price: number | null
  original_price: number | null
  currency_id: string | null
  available_quantity: number | null
  sold_quantity: number | null
  initial_quantity: number | null
  status: string | null
  condition: string | null
  listing_type_id: string | null
  buying_mode: string | null
  thumbnail: string | null
  permalink: string | null
  category_id: string | null
  domain_id: string | null
  catalog_product_id: string | null
  seller_custom_field: string | null
  warranty: string | null
  health: number | null
  automatic_relist: boolean | null
  catalog_listing: boolean | null
  date_created: string | null
  last_updated: string | null
  synced_at: string | null
  start_time: string | null
  stop_time: string | null
  shipping: Record<string, unknown> | null
  tags: unknown[] | null
  attributes: unknown[] | null
  pictures: unknown[] | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
  under_review: 'En revisión',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
  under_review: 'bg-blue-100 text-blue-700',
}

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right font-medium break-all">{value}</span>
    </div>
  )
}

export default function ProductsTable({ products, count }: { products: Product[]; count: number }) {
  const [selected, setSelected] = useState<Product | null>(null)

  return (
    <div className="relative">
      {/* Backdrop */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium w-12"></th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Precio</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Vendidos</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
                className={`cursor-pointer transition-colors ${selected?.id === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-4 py-3">
                  {p.thumbnail ? (
                    <Image
                      src={p.thumbnail.replace('http://', 'https://')}
                      alt={p.title}
                      width={40}
                      height={40}
                      className="rounded object-contain w-10 h-10"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded" />
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-medium text-gray-900 line-clamp-2 text-sm">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.condition === 'new' ? 'Nuevo' : 'Usado'} · {p.id}</p>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-600">{p.sku ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                  {formatPrice(p.price, p.currency_id)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{p.available_quantity ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{p.sold_quantity ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABEL[p.status ?? ''] ?? p.status ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel — slides in from the right */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[900px] bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          selected ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selected && <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              {selected.thumbnail && (
                <Image
                  src={selected.thumbnail.replace('http://', 'https://')}
                  alt={selected.title}
                  width={48}
                  height={48}
                  className="rounded object-contain shrink-0"
                  unoptimized
                />
              )}
              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 leading-snug line-clamp-2">{selected.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{selected.id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="ml-4 shrink-0 text-gray-400 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6">
            <div className="max-w-[600px] mx-auto space-y-2">

              <Accordion title="General" defaultOpen>
                <InfoRow label="ID ML" value={selected.id} />
                <InfoRow label="SKU" value={selected.sku} />
                <InfoRow label="Campo vendedor" value={selected.seller_custom_field} />
                <InfoRow label="ID catálogo" value={selected.catalog_product_id} />
                <InfoRow label="Categoría" value={selected.category_id} />
                <InfoRow label="Dominio" value={selected.domain_id} />
                <InfoRow label="Precio" value={formatPrice(selected.price, selected.currency_id)} />
                <InfoRow label="Precio base" value={formatPrice(selected.base_price, selected.currency_id)} />
                <InfoRow label="Precio original" value={formatPrice(selected.original_price, selected.currency_id)} />
                <InfoRow label="Moneda" value={selected.currency_id} />
              </Accordion>

              <Accordion title="Stock y ventas">
                <InfoRow label="Stock disponible" value={selected.available_quantity} />
                <InfoRow label="Stock inicial" value={selected.initial_quantity} />
                <InfoRow label="Vendidos" value={selected.sold_quantity} />
              </Accordion>

              <Accordion title="Publicación">
                <InfoRow label="Estado" value={STATUS_LABEL[selected.status ?? ''] ?? selected.status} />
                <InfoRow label="Condición" value={selected.condition === 'new' ? 'Nuevo' : selected.condition === 'used' ? 'Usado' : selected.condition} />
                <InfoRow label="Tipo de publicación" value={selected.listing_type_id} />
                <InfoRow label="Modo de compra" value={selected.buying_mode} />
                <InfoRow label="Garantía" value={selected.warranty} />
                <InfoRow label="Salud" value={selected.health != null ? `${(selected.health * 100).toFixed(0)}%` : null} />
                <InfoRow label="Relisting automático" value={selected.automatic_relist != null ? (selected.automatic_relist ? 'Sí' : 'No') : null} />
                <InfoRow label="En catálogo" value={selected.catalog_listing != null ? (selected.catalog_listing ? 'Sí' : 'No') : null} />
              </Accordion>

              {selected.shipping && (
                <Accordion title="Envío">
                  {Object.entries(selected.shipping).map(([key, val]) => (
                    <InfoRow key={key} label={key} value={typeof val === 'object' ? JSON.stringify(val) : String(val)} />
                  ))}
                </Accordion>
              )}

              <Accordion title="Fechas">
                <InfoRow label="Creado" value={formatDate(selected.date_created)} />
                <InfoRow label="Actualizado" value={formatDate(selected.last_updated)} />
                <InfoRow label="Inicio" value={formatDate(selected.start_time)} />
                <InfoRow label="Fin" value={formatDate(selected.stop_time)} />
                <InfoRow label="Sincronizado" value={formatDate(selected.synced_at)} />
              </Accordion>

              {selected.permalink && (
                <a
                  href={selected.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full text-sm text-blue-600 border border-blue-200 rounded-xl py-3 hover:bg-blue-50 transition-colors font-medium"
                >
                  Ver en MercadoLibre →
                </a>
              )}
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
