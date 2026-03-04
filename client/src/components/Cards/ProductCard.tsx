'use client';

import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { Product } from '@/types/api/products';
import { formatMoney } from '@/lib/decimal';
import { t } from '@/i18n';
export type PosProductCardProps = {
  product: Product;
  selected: boolean;
  disabled?: boolean;
  onToggle: (product: Product) => void;
};
const renderStock = (qty?: number) => {
  if (qty === undefined || qty === null) return '—';
  if (Number(qty) === -1) return '∞';
  return String(qty);
};
export default function PosProductCard({ product, selected, disabled = false, onToggle }: PosProductCardProps) {
  const priceLabel = `${formatMoney(product.price)} ${product.currency ?? ''}`.trim();
  const stockLabel = renderStock(product.stock_quantity);
  const outOfStock =
    product.stock_quantity !== undefined &&
    product.stock_quantity !== null &&
    Number(product.stock_quantity) !== -1 &&
    Number(product.stock_quantity) <= 0;
  return (
    <label className={clsx('block', disabled ? 'cursor-not-allowed' : 'cursor-pointer')} aria-disabled={disabled}>
      <input
        type='checkbox'
        className='sr-only'
        checked={selected}
        onChange={() => {
          if (disabled) return;
          onToggle(product);
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
            <h3 className='text-sm font-semibold text-gray-900'>{product.name || t('ui.untitled')}</h3>
            {product.description && <p className='text-xs text-gray-500 truncate'>{product.description}</p>}
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
          <span>{t('ui.remainder')}</span>
          <span>{stockLabel}</span>
        </div>

        {!product.active && (
          <div className='mt-3 inline-flex rounded-full bg-gray-200/80 px-2 py-1 text-xs text-gray-600'>
            {t('ui.not_active')}
          </div>
        )}
        {outOfStock && (
          <div className='mt-2 inline-flex rounded-full bg-amber-100/80 px-2 py-1 text-xs text-amber-700'>
            {t('ui.out_of_stock')}
          </div>
        )}
      </div>
    </label>
  );
}
