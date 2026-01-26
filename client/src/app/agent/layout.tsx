import { CookiesProvider } from 'next-client-cookies/server';
import SidebarAgent from '@/components/Layouts/SidebarAgent';
import ContainerDefault from '@/components/Containers/ContainerDefault';
import RoleGuard from '@/components/Guards/RoleGuard';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <CookiesProvider>
      <RoleGuard allowedRoles={['admin', 'agent']}>
        <div className='flex h-screen'>
          <SidebarAgent />

          <main className='flex-1 overflow-auto'>
            <ContainerDefault>{children}</ContainerDefault>
          </main>
        </div>
      </RoleGuard>
    </CookiesProvider>
  );
}
