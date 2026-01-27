'use client';

import { usePathname, useRouter } from 'next/navigation';
import ButtonDefault from '@/components/Buttons/ButtonDefault';

export default function NotAllowedPage() {
  const router = useRouter();
  const pathname = usePathname();
  const areaPrefix = pathname?.startsWith('/admin') ? '/admin' : pathname?.startsWith('/agent') ? '/agent' : '';

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4'>
      <div className='text-center max-w-md'>
        <h1 className='text-6xl font-bold mb-4'>403</h1>

        <p className='text-lg text-muted-foreground mb-6'>Доступ запрещен.</p>

        <ButtonDefault variant='dark' onClick={() => router.push(`${areaPrefix}/login`)}>
          Вернуться
        </ButtonDefault>
      </div>
    </div>
  );
}
