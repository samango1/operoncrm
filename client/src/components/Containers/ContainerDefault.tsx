import React, { ReactNode } from 'react';

interface ContainerDefaultProps {
  children: ReactNode;
}

const ContainerDefault: React.FC<ContainerDefaultProps> = ({ children }) => {
  return <div className='w-[80%] mx-auto'>{children}</div>;
};

export default ContainerDefault;
