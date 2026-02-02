'use client';

import React, { ReactNode } from 'react';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';

type ButtonVariant = React.ComponentProps<typeof ButtonDefault>['variant'];

type ConfirmModalWindowProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  disableConfirm?: boolean;
  showCloseIcon?: boolean;
  children?: ReactNode;
};

export default function ConfirmModalWindow({
  isOpen,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  confirmVariant = 'positive',
  loading = false,
  disableConfirm = false,
  showCloseIcon = true,
  children,
}: ConfirmModalWindowProps) {
  return (
    <ModalWindowDefault isOpen={isOpen} onClose={onClose} showCloseIcon={showCloseIcon}>
      <div className='space-y-4'>
        <div className='space-y-2'>
          <h2 className='text-xl font-semibold'>{title}</h2>
          {description && <div className='text-sm text-gray-600'>{description}</div>}
        </div>

        {children}

        <div className='flex items-center justify-end gap-3'>
          <ButtonDefault type='button' variant='outline' onClick={onClose} disabled={loading}>
            {cancelText}
          </ButtonDefault>
          <ButtonDefault type='button' variant={confirmVariant} onClick={onConfirm} disabled={loading || disableConfirm}>
            {loading ? 'Подтверждение...' : confirmText}
          </ButtonDefault>
        </div>
      </div>
    </ModalWindowDefault>
  );
}
