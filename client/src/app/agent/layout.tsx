import { CookiesProvider } from 'next-client-cookies/server';
export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <CookiesProvider>
      <main>{children}</main>
    </CookiesProvider>
  );
}
