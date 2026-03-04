'use client';

import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { Service } from '@/types/api/services';
import { formatMoney } from '@/lib/decimal';
import { t } from '@/i18n';
export type PosServiceCardProps = {
  service: Service;
  selected: boolean;
  disabled?: boolean;
  onToggle: (service: Service) => void;
};
const formatDuration = (minutes?: number | null): string => {
  if (minutes === null || minutes === undefined) return '';
  if (minutes === -1) return t('ui.one_time');
  if (minutes < 60)
    return t('ui.value_0_min', {
      v0: minutes,
    });
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (minutes < 60 * 24) {
    return mins
      ? t('ui.value_0_h_value_1_min', {
          v0: hours,
          v1: mins,
        })
      : t('ui.value_0_h', {
          v0: hours,
        });
  }
  const days = Math.floor(minutes / (60 * 24));
  const remainHours = Math.floor((minutes % (60 * 24)) / 60);
  if (remainHours > 0)
    return t('ui.value_0_d_value_1_h', {
      v0: days,
      v1: remainHours,
    });
  return t('ui.value_0_d', {
    v0: days,
  });
};
export default function PosServiceCard({ service, selected, disabled = false, onToggle }: PosServiceCardProps) {
  const priceLabel = `${formatMoney(service.price)} ${service.currency ?? ''}`.trim();
  const durationLabel = formatDuration(service.duration_minutes) || '—';
  return (
    <label className={clsx('block', disabled ? 'cursor-not-allowed' : 'cursor-pointer')} aria-disabled={disabled}>
      <input
        type='checkbox'
        className='sr-only'
        checked={selected}
        onChange={() => {
          if (disabled) return;
          onToggle(service);
        }}
        disabled={disabled}
      />
      <div
        className={clsx(
          'relative rounded-2xl border p-4 shadow-sm transition-all',
          'bg-white/85 backdrop-blur-sm',
          selected ? 'border-blue-300 ring-2 ring-blue-200/70 bg-blue-50/70' : 'border-gray-200 hover:border-gray-300',
          disabled && 'opacity-70'
        )}
      >
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1'>
            <h3 className='text-sm font-semibold text-gray-900'>{service.name || t('ui.untitled')}</h3>
            {service.description && <p className='text-xs text-gray-500 truncate'>{service.description}</p>}
          </div>

          <span
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-md border transition',
              selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-transparent'
            )}
            aria-hidden
          >
            <Check className='h-4 w-4' />
          </span>
        </div>

        <div className='mt-4 flex items-center justify-between text-sm'>
          <span className='text-gray-500'>{t('ui.price')}</span>
          <span className='font-medium text-gray-900'>{priceLabel}</span>
        </div>

        <div className='mt-1 flex items-center justify-between text-xs text-gray-500'>
          <span>{t('ui.duration')}</span>
          <span>{durationLabel}</span>
        </div>

        {!service.active && (
          <div className='mt-3 inline-flex rounded-full bg-gray-200/80 px-2 py-1 text-xs text-gray-600'>
            {t('ui.not_active_2')}
          </div>
        )}
      </div>
    </label>
  );
}
