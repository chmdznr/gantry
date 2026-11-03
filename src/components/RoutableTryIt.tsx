'use client'

import { useEffect, useState } from 'react'
import TryIt from './TryIt'
import { isEndpointRoutable, type GatewayRoute } from '@/lib/routable'
import type { TryEndpoint } from '@/lib/tryit'

// Cek routability butuh Kong Admin API. Jangan tahan render Try It: tampilkan dulu
// dengan semua endpoint dianggap routable (perilaku konservatif yang sama dengan
// Kong tidak terjangkau), lalu terapkan flag begitu hasilnya tiba. Tidak ada
// endpoint yang dimatikan sebelum datanya benar-benar ada.
export default function RoutableTryIt({ productId, baseUrl, endpoints, routesPromise }: {
  productId: string
  baseUrl: string
  endpoints: TryEndpoint[]
  routesPromise: Promise<GatewayRoute[] | null>
}) {
  const [routes, setRoutes] = useState<GatewayRoute[] | null>(null)

  useEffect(() => {
    let alive = true
    routesPromise.then((resolved) => { if (alive) setRoutes(resolved) })
    return () => { alive = false }
  }, [routesPromise])

  const withFlags = routes
    ? endpoints.map((e) => ({ ...e, routable: isEndpointRoutable(e.path, e.method, routes) }))
    : endpoints

  return <TryIt productId={productId} baseUrl={baseUrl} endpoints={withFlags} />
}
