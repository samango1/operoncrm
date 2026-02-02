'use client';

import React, { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

export type SelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

interface SelectOptionProps<T extends string | number> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: React.ReactNode;
  placeholder?: string;
  error?: string;
  options: SelectOption<T>[];
  value?: T;
  onChange: (value: T | undefined) => void;
}

export default function SelectOption<T extends string | number>({
  label,
  placeholder = 'Выберите значение',
  error,
  options,
  value,
  onChange,
  disabled,
  className,
  ...props
}: SelectOptionProps<T>) {
  return (
    <div className='flex flex-col'>
      {label && <label className='mb-1 text-md font-medium text-gray-700'>{label}</label>}

      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? undefined : (e.target.value as T))}
        className={clsx(
          'h-10 rounded-md border cursor-pointer px-3 text-md outline-none transition focus:ring-2 focus:ring-blue-500',
          'bg-white',
          disabled && 'cursor-not-allowed opacity-50',
          error ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:ring-1 focus:ring-black',
          className
        )}
        {...props}
      >
        <option value='' disabled>
          {placeholder}
        </option>

        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && <span className='text-xs text-red-500'>{error}</span>}
    </div>
  );
}
