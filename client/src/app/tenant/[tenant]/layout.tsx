import { CookiesProvider } from 'next-client-cookies/server';
interface TenantLayoutProps {
  children: React.ReactNode;
}

export default async function TenantLayout({ children }: TenantLayoutProps) {
  return (
    <CookiesProvider>
      <main>{children}</main>
    </CookiesProvider>
  );
}
