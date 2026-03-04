import { CookiesProvider } from 'next-client-cookies/server';
import Sidebar from '@/components/Layouts/Sidebar';
import type { SidebarItem } from '@/components/Layouts/Sidebar';
import ContainerDefault from '@/components/Containers/ContainerDefault';

interface TenantLayoutProps {
  children: React.ReactNode;
}
export default async function TenantLayout({ children }: TenantLayoutProps) {
  const items: SidebarItem[] = [
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
      <div className='flex h-screen'>
        <Sidebar items={items} />
        <main className='flex-1 overflow-auto pb-20 md:pb-0'>
          <ContainerDefault>{children}</ContainerDefault>
        </main>
      </div>
    </CookiesProvider>
  );
}
