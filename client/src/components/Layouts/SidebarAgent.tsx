'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, Users, Building2, Banknote, Contact } from 'lucide-react';
import clsx from 'clsx';
import ButtonDefault from '../Buttons/ButtonDefault';

const items = [
  { path: '/', label: 'Дашборд', icon: Home },
  { path: '/users', label: 'Пользователи', icon: Users },
  { path: '/companies', label: 'Компании', icon: Building2 },
  { path: '/transactions', label: 'Транзакции', icon: Banknote },
  { path: '/clients', label: 'Клиенты', icon: Contact },
];

export default function SidebarAgent() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname?.includes('/login')) return null;

  return (
    <aside className='fixed inset-x-0 bottom-0 z-40 w-full p-2 md:static md:h-screen md:w-80 md:p-3'>
      <div className='h-full rounded-2xl bg-white shadow-md flex md:flex-col flex-row items-center md:items-stretch border border-gray-200 md:border-0'>
        <div className='hidden md:block px-4 py-3 text-2xl font-semibold text-gray-700'>OperonCRM</div>

        <nav className='flex-1 md:px-2 md:space-y-1 flex flex-row md:flex-col gap-1 md:gap-0 w-full'>
          {items.map(({ path, label, icon: Icon }) => (
            <ButtonDefault
              variant='navigation'
              key={path}
              className={clsx(
                'group flex-1 md:flex-none md:w-full flex items-center md:items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2 rounded-xl text-md transition',
                pathname === path && 'bg-black/5 text-gray-900'
              )}
              onClick={() => router.push(path)}
            >
              <Icon className='w-5 h-5 opacity-70 group-hover:opacity-100' />
              <span className='hidden md:inline'>{label}</span>
            </ButtonDefault>
          ))}
        </nav>
      </div>
    </aside>
  );
}
