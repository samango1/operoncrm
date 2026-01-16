'use client';

import React, { SelectHTMLAttributes, useEffect, useState } from 'react';
import clsx from 'clsx';
import type { SelectOption as OptionType } from './SelectOption';

interface SelectMultipleProps<T extends string | number> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  label?: string;
  placeholder?: string;
  error?: string;
  options: OptionType<T>[];
  value?: T[];
  onChange: (value: T[]) => void;
  disabled?: boolean;
  className?: string;
}

export default function SelectMultiple<T extends string | number>({
  label,
  placeholder = 'Выберите значение',
  error,
  options,
  value = [],
  onChange,
  disabled,
  className,
  ...props
}: SelectMultipleProps<T>) {
  const [currentKey, setCurrentKey] = useState<string>('');

  useEffect(() => {
    if (currentKey === '') return;
    const exists = options.some((o) => String(o.value) === currentKey && !o.disabled);
    if (!exists) setCurrentKey('');
  }, [options, currentKey]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentKey(e.target.value);
  };

  const handleAdd = () => {
    if (disabled || currentKey === '') return;
    const opt = options.find((o) => String(o.value) === currentKey);
    if (!opt) return;
    if (opt.disabled) return;
    if (value.some((v) => String(v) === String(opt.value))) {
      setCurrentKey('');
      return;
    }
    onChange([...value, opt.value]);
    setCurrentKey('');
  };

  const handleRemove = (val: T) => {
    onChange(value.filter((v) => String(v) !== String(val)));
  };

  const isAddDisabled = (() => {
    if (disabled) return true;
    if (currentKey === '') return true;
    const opt = options.find((o) => String(o.value) === currentKey);
    if (!opt) return true;
    if (opt.disabled) return true;
    if (value.some((v) => String(v) === String(opt.value))) return true;
    return false;
  })();

  return (
    <div className='flex flex-col'>
      {label && <label className='mb-1 text-md font-medium text-gray-700'>{label}</label>}

      <div className='flex justify-between gap-2'>
        <select
          value={currentKey}
          disabled={disabled}
          onChange={handleSelectChange}
          className={clsx(
            'h-10 rounded-md border w-full cursor-pointer px-3 text-md outline-none transition focus:ring-2 focus:ring-blue-500',
            'bg-white',
            disabled && 'cursor-not-allowed opacity-50',
            error ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:ring-1 focus:ring-black',
            className
          )}
          {...props}
        >
          <option value=''>{placeholder}</option>

          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type='button'
          onClick={handleAdd}
          disabled={isAddDisabled}
          aria-label='Добавить'
          className={clsx(
            'h-10 px-3 rounded-md border flex items-center justify-center select-none',
            isAddDisabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300 hover:bg-gray-50',
            'transition'
          )}
        >
          +
        </button>
      </div>

      {error && <span className='text-xs text-red-500 mt-1'>{error}</span>}

      <div className='mt-3 flex flex-wrap gap-2'>
        {value.length === 0 && <span className='text-sm text-gray-500'>Пусто</span>}

        {value.map((val) => {
          const opt = options.find((o) => String(o.value) === String(val));
          const labelText = opt ? opt.label : String(val);
          return (
            <span
              key={String(val)}
              className='inline-flex items-center gap-2 px-3 py-1 pr-1 rounded-2xl bg-gray-100 border border-gray-200 text-sm'
            >
              <span>{labelText}</span>
              <button
                type='button'
                onClick={() => handleRemove(val)}
                aria-label={`Удалить ${labelText}`}
                className='w-5 h-5 rounded-full flex items-center cursor-pointer justify-center hover:bg-red-200 transition'
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
