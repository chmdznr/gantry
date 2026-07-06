'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import * as kong from '@/lib/kong'

export async function fixPrometheusPlugin(): Promise<void> {
  const session = await requireAdmin()
  await kong.ensurePrometheusPerConsumer()
  await audit(session.user.id, 'setup.fix_prometheus', 'kong_plugin', 'prometheus')
  revalidatePath('/admin/setup')
}
