import React, { ReactNode } from 'react';
import clsx from 'clsx';

interface ContainerDefaultProps {
  children: ReactNode;
  className?: string;
}

const ContainerDefault: React.FC<ContainerDefaultProps> = ({ children, className }) => {
  return <div className={clsx('p-6 max-w-6xl mx-auto', className)}>{children}</div>;
};

export default ContainerDefault;
