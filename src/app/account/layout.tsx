import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}
