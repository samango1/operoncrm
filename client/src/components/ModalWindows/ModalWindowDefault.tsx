'use client';

import React, { ReactNode, useEffect } from 'react';
import clsx from 'clsx';
import ButtonDefault from '../Buttons/ButtonDefault';
import { t } from '@/i18n';
type ModalWindowDefaultProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseIcon?: boolean;
  className?: string;
};
export default function ModalWindowDefault({
  isOpen,
  onClose,
  children,
  showCloseIcon = true,
  className,
}: ModalWindowDefaultProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 bg-opacity-50 p-4 sm:p-6' onClick={onClose}>
      <div
        className={clsx(
          'relative bg-white rounded-xl w-full max-w-lg p-6 sm:p-8 shadow-lg',
          'max-h-[80vh] overflow-y-auto',
          'sm:mx-0',
          'transition-transform transform scale-100 sm:scale-100',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseIcon && (
          <ButtonDefault onClick={onClose} className='absolute top-5 right-5' aria-label={t('ui.close')} variant='dark'>
            &#10005;
          </ButtonDefault>
        )}

        {children}
      </div>
    </div>
  );
}
