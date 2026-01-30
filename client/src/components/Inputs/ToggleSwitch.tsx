'use client';

import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
  className?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  onLabel,
  offLabel,
  disabled = false,
  className = '',
}: ToggleSwitchProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && <span className='text-sm text-gray-700'>{label}</span>}
      {(onLabel || offLabel) && (
        <span className='inline-grid text-sm text-gray-500 whitespace-nowrap'>
          <span className='col-start-1 row-start-1'>{checked ? onLabel : offLabel}</span>
          {onLabel && <span className='col-start-1 row-start-1 opacity-0 select-none'>{onLabel}</span>}
          {offLabel && <span className='col-start-1 row-start-1 opacity-0 select-none'>{offLabel}</span>}
        </span>
      )}
      <label className={`relative inline-flex items-center ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type='checkbox'
          className='sr-only peer'
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors' />
        <span className='absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5' />
      </label>
    </div>
  );
}
