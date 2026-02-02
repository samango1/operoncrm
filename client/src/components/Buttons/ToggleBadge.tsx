'use client';

import React from 'react';
import clsx from 'clsx';

interface ToggleBadgeProps {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export default function ToggleBadge({ active = false, onClick, className, children }: ToggleBadgeProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={clsx(
        'px-3 py-1 rounded-full border transition cursor-pointer',
        active ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-gray-300',
        className
      )}
    >
      {children}
    </button>
  );
}
