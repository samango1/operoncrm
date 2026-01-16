import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Badge {
  name: string;
  icon: LucideIcon;
}

interface ContainerBadgesProps {
  title: string;
  badges: Badge[];
}

const ContainerBadges: React.FC<ContainerBadgesProps> = ({ title, badges }) => {
  return (
    <div className='bg-white p-4 rounded-lg'>
      <h3 className='text-lg mb-2'>{title}</h3>
      {badges.map((badge, index) => {
        const IconComponent = badge.icon;
        return (
          <div key={index} className='flex items-center gap-2'>
            <IconComponent className='w-5 h-5' />
            {badge.name}
          </div>
        );
      })}
    </div>
  );
};

export default ContainerBadges;
