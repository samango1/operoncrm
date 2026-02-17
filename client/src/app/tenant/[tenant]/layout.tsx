import { CookiesProvider } from 'next-client-cookies/server';
import Sidebar from '@/components/Layouts/Sidebar';
import type { SidebarItem } from '@/components/Layouts/Sidebar';
import ContainerDefault from '@/components/Containers/ContainerDefault';
interface TenantLayoutProps {
  children: React.ReactNode;
}

export default async function TenantLayout({ children }: TenantLayoutProps) {
  const items: SidebarItem[] = [
    { path: '/statistics', label: 'Статистика', icon: 'statistics' },
    { path: '/transactions', label: 'Транзакции', icon: 'transactions' },
    { path: '/clients', label: 'Клиенты', icon: 'clients' },
    { path: '/products', label: 'Продукты', icon: 'products' },
    { path: '/services', label: 'Услуги', icon: 'services' },
    { path: '/service-deliveries', label: 'Услуги клиентов', icon: 'service-deliveries' },
    { path: '/service-pos', label: 'Предоставление услуг', icon: 'pos' },
    { path: '/pos', label: 'Продажа продукции', icon: 'pos' },
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
