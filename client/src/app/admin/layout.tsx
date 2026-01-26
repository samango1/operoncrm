import { CookiesProvider } from 'next-client-cookies/server';
import SidebarAdmin from '@/components/Layouts/SidebarAdmin';
import ContainerDefault from '@/components/Containers/ContainerDefault';
import RoleGuard from '@/components/Guards/RoleGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CookiesProvider>
      <RoleGuard allowedRoles={['admin']}>
        <div className='flex h-screen'>
          <SidebarAdmin />

          <main className='flex-1 overflow-auto pb-20 md:pb-0'>
            <ContainerDefault>{children}</ContainerDefault>
          </main>
        </div>
      </RoleGuard>
    </CookiesProvider>
  );
}
