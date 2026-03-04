'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useCookies } from '@/hooks/useCookies';
import { readOptionalSectionOpen, writeOptionalSectionOpen } from '@/lib/preferencesCookies';
import { t } from '@/i18n';
interface OptionalSectionProps {
  title?: string;
  defaultOpen?: boolean;
  className?: string;
  preferenceId?: string;
  children: React.ReactNode;
}
export default function OptionalSection({
  title = t('ui.additional'),
  defaultOpen = false,
  className,
  preferenceId,
  children,
}: OptionalSectionProps) {
  const cookies = useCookies();
  const cookiesRef = useRef(cookies);
  useEffect(() => {
    cookiesRef.current = cookies;
  }, [cookies]);
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (!preferenceId) return defaultOpen;
    return readOptionalSectionOpen(cookiesRef.current, preferenceId, defaultOpen);
  });
  useEffect(() => {
    if (!preferenceId) return;
    writeOptionalSectionOpen(cookiesRef.current, preferenceId, isOpen);
  }, [isOpen, preferenceId]);
  return (
    <details
      className={clsx('rounded-md', className)}
      open={isOpen}
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className='cursor-pointer select-none text-md font-medium text-gray-600 list-none inline-flex items-center gap-2 [&::-webkit-details-marker]:hidden'>
        <span>{title}</span>
        <span className={clsx('text-gray-400 transition-transform', isOpen && 'rotate-180')}>▾</span>
      </summary>
      <div className='mt-3 space-y-3'>{children}</div>
    </details>
  );
}
