import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import SpecEditor from '@/components/SpecEditor'

// Template awal supaya editor tidak kosong saat product belum punya spec.
const EMPTY_SPEC = {
  openapi: '3.0.0',
  info: { title: '', version: '1.0.0' },
  paths: {},
}

export default async function EditSpecPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await db.query.apiProducts.findFirst({
    where: eq(apiProducts.id, id),
    columns: { id: true, name: true, slug: true, openapiSpec: true },
  })
  if (!product) notFound()

  const initialText = JSON.stringify(product.openapiSpec ?? { ...EMPTY_SPEC, info: { title: product.name, version: '1.0.0' } }, null, 2)

  return (
    <main>
      <p className="mb-2 text-sm">
        <Link href={`/admin/apis/${product.id}`} className="text-muted hover:underline">← {product.name}</Link>
      </p>
      <h1 className="mb-1 text-xl font-bold">Edit spec — {product.name}</h1>
      <p className="mb-4 text-sm text-muted">
        OpenAPI JSON (paste Postman Collection v2 juga bisa — dikonversi otomatis saat save).
        Setiap perubahan tercatat di version history.
      </p>
      <SpecEditor productId={product.id} initialText={initialText} />
    </main>
  )
}
