'use client';

import React, { ButtonHTMLAttributes } from 'react';
import cn from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'positive' | 'outline' | 'dark' | 'ghost' | 'navigation' | 'disabled';
type ButtonType = 'button' | 'submit' | 'reset';

interface ButtonDefaultProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  type?: ButtonType;
  className?: string;
}

const baseClasses = 'px-4 py-2 rounded transition-colors duration-200 focus:outline-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  positive: 'bg-green-600 hover:bg-green-700 text-white',
  outline: 'border border-gray-400 text-gray-900 hover:bg-gray-100',
  dark: 'bg-gray-900 hover:bg-gray-800 text-white',
  ghost: 'bg-gray-500 hover:bg-gray-700 text-white',
  navigation: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  disabled: 'bg-gray-300 text-gray-600',
};

const disabledClasses = 'cursor-not-allowed';
const enabledClasses = 'cursor-pointer';

const ButtonDefault: React.FC<ButtonDefaultProps> = ({
  variant = 'primary',
  type = 'button',
  className,
  children,
  ...props
}) => {
  const isDisabled = variant === 'disabled' || props.disabled;

  return (
    <button
      type={type}
      className={cn(baseClasses, isDisabled ? disabledClasses : enabledClasses, variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
};

export default ButtonDefault;
