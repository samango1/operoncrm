import React from 'react';
import clsx from 'clsx';

interface OptionalSectionProps {
  title?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export default function OptionalSection({
  title = 'Дополнительно',
  defaultOpen = false,
  className,
  children,
}: OptionalSectionProps) {
  return (
    <details className={clsx('rounded-md', className)} open={defaultOpen}>
      <summary className='cursor-pointer select-none text-md font-medium text-gray-600 list-none inline-flex items-center gap-2 [&::-webkit-details-marker]:hidden'>
        <span>{title}</span>
        <span className='text-gray-400'>▾</span>
      </summary>
      <div className='mt-3 space-y-3'>{children}</div>
    </details>
  );
}
