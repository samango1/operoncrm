import { CookiesProvider } from 'next-client-cookies/server';
import Sidebar from '@/components/Layouts/Sidebar';
import type { SidebarItem } from '@/components/Layouts/Sidebar';
import ContainerDefault from '@/components/Containers/ContainerDefault';
import RoleGuard from '@/components/Guards/RoleGuard';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const items: SidebarItem[] = [
    {
      path: '/',
      label: 'ui.dashboard',
      icon: 'home',
    },
    {
      path: '/users',
      label: 'ui.users',
      icon: 'users',
    },
    {
      path: '/companies',
      label: 'ui.companies',
      icon: 'companies',
    },
    {
      path: '/statistics',
      label: 'ui.statistics',
      icon: 'statistics',
    },
    {
      path: '/transactions',
      label: 'ui.transactions',
      icon: 'transactions',
    },
    {
      path: '/transaction-categories',
      label: 'ui.categories',
      icon: 'categories',
    },
    {
      path: '/clients',
      label: 'ui.clients',
      icon: 'clients',
    },
    {
      path: '/products',
      label: 'ui.products_2',
      icon: 'products',
    },
    {
      path: '/services',
      label: 'ui.services_3',
      icon: 'services',
    },
    {
      path: '/service-deliveries',
      label: 'ui.customer_services',
      icon: 'service-deliveries',
    },
    {
      path: '/service-pos',
      label: 'ui.service_delivery',
      icon: 'pos',
    },
    {
      path: '/pos',
      label: 'ui.product_sale',
      icon: 'pos',
    },
  ];
  return (
    <CookiesProvider>
      <RoleGuard allowedRoles={['admin', 'agent']}>
        <div className='flex h-screen'>
          <Sidebar items={items} />

          <main className='flex-1 overflow-auto pb-20 md:pb-0'>
            <ContainerDefault>{children}</ContainerDefault>
          </main>
        </div>
      </RoleGuard>
    </CookiesProvider>
  );
}
