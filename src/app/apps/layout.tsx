import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}
