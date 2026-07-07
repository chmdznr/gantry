import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

export default function ApisLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}
