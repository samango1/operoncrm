import { CookiesProvider } from 'next-client-cookies/server';
import SidebarAdmin from '@/components/Layouts/SidebarAdmin';
import ContainerDefault from '@/components/Containers/ContainerDefault';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CookiesProvider>
      <div className='flex h-screen'>
        <SidebarAdmin />

        <main className='flex-1 overflow-auto'>
          <ContainerDefault>{children}</ContainerDefault>
        </main>
      </div>
    </CookiesProvider>
  );
}
