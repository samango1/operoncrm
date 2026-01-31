'use client';

import React, { InputHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { SelectOption as OptionType } from './SelectOption';
import InputDefault from './InputDefault';

interface SelectMultipleProps<T extends string | number> extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
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
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredOptions = useMemo(() => {
    const selected = new Set((value ?? []).map((v) => String(v)));
    const base = options.filter((o) => !selected.has(String(o.value)));
    const query = search.trim().toLowerCase();
    if (!query) return base;
    return base.filter((o) => o.label.toLowerCase().includes(query) || String(o.value).toLowerCase().includes(query));
  }, [options, value, search]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleAdd = (opt: OptionType<T>) => {
    if (disabled || opt.disabled) return;
    if (value.some((v) => String(v) === String(opt.value))) return;
    onChange([...value, opt.value]);
    setSearch('');
    setIsOpen(false);
    requestAnimationFrame(() => inputRef.current?.blur());
  };

  const handleRemove = (val: T) => {
    onChange(value.filter((v) => String(v) !== String(val)));
  };

  const handleFocus = () => {
    if (!disabled) setIsOpen(true);
  };

  const handleBlur = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  return (
    <div className='flex flex-col'>
      {label && <label className='mb-1 text-md font-medium text-gray-700'>{label}</label>}

      <div className='relative'>
        <InputDefault
          ref={inputRef}
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={clsx(
            disabled && 'cursor-not-allowed opacity-50',
            error ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:ring-1 focus:ring-black',
            className
          )}
          {...props}
        />

        {isOpen && !disabled && (
          <div className='absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm'>
            {filteredOptions.length === 0 ? (
              <div className='px-3 py-2 text-sm text-gray-500'>Ничего не найдено</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  type='button'
                  disabled={opt.disabled}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAdd(opt);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm hover:bg-gray-100',
                    opt.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && <span className='text-xs text-red-500 mt-1'>{error}</span>}

      <div className='mt-3 flex flex-wrap gap-2'>
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
