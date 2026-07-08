import { redirect } from 'next/navigation'

// /admin tidak punya konten sendiri; tombol "Admin" di SiteHeader menaut ke sini
export default function AdminIndexPage() {
  redirect('/admin/apis')
}
