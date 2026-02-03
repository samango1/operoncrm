import { CookiesProvider } from 'next-client-cookies/server';
import Sidebar from '@/components/Layouts/Sidebar';
import type { SidebarItem } from '@/components/Layouts/Sidebar';
import ContainerDefault from '@/components/Containers/ContainerDefault';
import RoleGuard from '@/components/Guards/RoleGuard';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const items: SidebarItem[] = [
    { path: '/', label: 'Дашборд', icon: 'home' },
    { path: '/users', label: 'Пользователи', icon: 'users' },
    { path: '/companies', label: 'Компании', icon: 'companies' },
    { path: '/transactions', label: 'Транзакции', icon: 'transactions' },
    { path: '/transaction-categories', label: 'Категории', icon: 'categories' },
    { path: '/clients', label: 'Клиенты', icon: 'clients' },
    { path: '/products', label: 'Продукты', icon: 'products' },
    { path: '/services', label: 'Услуги', icon: 'services' },
    { path: '/service-deliveries', label: 'Услуги клиентов', icon: 'service-deliveries' },
    { path: '/service-pos', label: 'Предоставление услуг', icon: 'pos' },
    { path: '/pos', label: 'Продажа продукции', icon: 'pos' },
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
