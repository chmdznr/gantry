import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-md flex-1 px-6 py-14">
        <div className="card p-8">{children}</div>
      </div>
      <SiteFooter />
    </>
  )
}
