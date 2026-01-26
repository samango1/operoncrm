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
    <aside className='h-screen w-80 p-3'>
      <div className='h-full rounded-xl bg-white shadow-md flex flex-col'>
        <div className='px-4 py-3 text-2xl font-semibold text-gray-700'>OperonCRM</div>

        <nav className='flex-1 px-2 space-y-1'>
          {items.map(({ path, label, icon: Icon }) => (
            <ButtonDefault
              variant='navigation'
              key={path}
              className={clsx(
                'group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-md transition',
                pathname === path && 'bg-black/5 text-gray-900'
              )}
              onClick={() => router.push(path)}
            >
              <Icon className='w-4 h-4 opacity-70 group-hover:opacity-100' />
              <span>{label}</span>
            </ButtonDefault>
          ))}
        </nav>
      </div>
    </aside>
  );
}
