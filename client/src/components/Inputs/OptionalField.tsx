'use client';

import React from 'react';

const OptionalField: React.FC = () => {
  return (
    <span className='ml-1 text-red-500' aria-hidden='true'>
      *
    </span>
  );
};

export default OptionalField;
