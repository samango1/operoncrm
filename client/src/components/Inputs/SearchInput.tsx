'use client';

import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import { Search } from 'lucide-react';
import { t } from '@/i18n';
interface SearchInputProps {
  initialValue?: string;
  placeholder?: string;
  onSearch?: (query: string) => void;
  debounceMs?: number;
}
const SearchInput: React.FC<SearchInputProps> = ({
  initialValue = '',
  placeholder = t('ui.search'),
  onSearch,
  debounceMs = 400,
}) => {
  const [value, setValue] = useState<string>(initialValue);
  const timeoutRef = useRef<number | null>(null);
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      onSearch?.(v);
    }, debounceMs);
  };
  return (
    <div className='w-full h-fit bg-white rounded-lg shadow-sm'>
      <InputDefault icon={Search} placeholder={placeholder} value={value} onChange={handleChange} />
    </div>
  );
};
export default SearchInput;
