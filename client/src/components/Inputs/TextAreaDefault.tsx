'use client';

import React, { TextareaHTMLAttributes } from 'react';

interface TextAreaDefaultProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  placeholder?: string;
  error?: string;
}

const TextAreaDefault: React.FC<TextAreaDefaultProps> = ({ label, placeholder, error, rows = 4, ...props }) => {
  return (
    <div className='flex flex-col w-full'>
      {label && <label className='mb-1 text-md font-medium text-gray-700'>{label}</label>}

      <textarea
        rows={rows}
        placeholder={placeholder}
        className={`
          w-full py-2 rounded px-3 border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
        {...props}
      />

      {error && <span className='text-red-500 text-sm mt-1'>{error}</span>}
    </div>
  );
};

export default TextAreaDefault;
