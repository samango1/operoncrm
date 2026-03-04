'use client';

import type { I18nKey } from '@/i18n/messages.en';
import { useI18n } from '@/i18n/useI18n';

interface PageHeaderTextProps {
  titleKey: I18nKey;
  subtitleKey?: I18nKey;
}

const PageHeaderText: React.FC<PageHeaderTextProps> = ({ titleKey, subtitleKey }) => {
  const { t } = useI18n();

  return (
    <div className='my-6'>
      <h1 className='font-bold text-4xl'>{t(titleKey)}</h1>
      <p className='font-bold text-lg'>{subtitleKey ? t(subtitleKey) : ''}</p>
    </div>
  );
};

export default PageHeaderText;
