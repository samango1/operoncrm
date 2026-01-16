'use client';

import React, { InputHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputDefaultProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  placeholder?: string;
  error?: string;
  prewritten?: string;
  type?: string;
}

const InputDefault: React.FC<InputDefaultProps> = ({
  icon: Icon,
  label,
  placeholder,
  error,
  prewritten,
  type = 'text',
  ...props
}) => {
  return (
    <div className='flex flex-col w-full'>
      {label && <label className='mb-1 text-md font-medium text-gray-700'>{label}</label>}

      <div className='flex items-stretch'>
        {prewritten && (
          <div className='px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-100 text-gray-500 select-none pointer-events-none'>
            {prewritten}
          </div>
        )}

        <div className='relative flex-1'>
          {Icon && <Icon size={18} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none' />}

          <input
            type={type}
            placeholder={placeholder}
            className={`
                            w-full py-2 border focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${Icon ? 'pl-10 pr-3' : 'px-3'}
                            ${prewritten ? 'rounded-l-none' : 'rounded-md'}
                            ${error ? 'border-red-500' : 'border-gray-300'}
                        `}
            {...props}
          />
        </div>
      </div>

      {error && <span className='text-red-500 text-sm mt-1'>{error}</span>}
    </div>
  );
};

export default InputDefault;
