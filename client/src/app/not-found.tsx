'use client';

import { useRouter } from 'next/navigation';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import { t } from '@/i18n';
export default function NotFound() {
  const router = useRouter();
  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4'>
      <div className='text-center max-w-md'>
        <h1 className='text-6xl font-bold mb-4'>404</h1>

        <p className='text-lg text-muted-foreground mb-6'>{t('ui.page_not_found')}</p>

        <ButtonDefault variant='dark' onClick={() => router.push('/')}>
          {t('ui.return_to_home')}
        </ButtonDefault>
      </div>
    </div>
  );
}
