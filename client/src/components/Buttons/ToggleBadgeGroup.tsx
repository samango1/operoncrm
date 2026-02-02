'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ToggleBadge from '@/components/Buttons/ToggleBadge';
import { useCookies } from '@/hooks/useCookies';
import { PreferenceCookies } from '@/lib/preferencesCookies';

type ToggleBadgeItem = {
  id: string;
  label: string;
};

interface ToggleBadgeGroupProps {
  items: ToggleBadgeItem[];
  storageKey: string;
  className?: string;
  children: (activeId: string | null) => React.ReactNode;
}

export default function ToggleBadgeGroup({ items, storageKey, className, children }: ToggleBadgeGroupProps) {
  const cookies = useCookies();
  const cookiesRef = useRef(cookies);
  useEffect(() => {
    cookiesRef.current = cookies;
  }, [cookies]);

  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const readActive = (c: PreferenceCookies): string | null => {
    const raw = c.get(storageKey);
    if (raw && itemIds.has(raw)) return raw;
    return null;
  };

  const [activeId, setActiveId] = useState<string | null>(() => readActive(cookiesRef.current));

  const handleToggle = (id: string) => {
    const next = activeId === id ? null : id;
    setActiveId(next);
    if (next === null) {
      cookiesRef.current.remove?.(storageKey, { path: '/' });
      return;
    }
    cookiesRef.current.set(storageKey, next, { path: '/' });
  };

  useEffect(() => {
    const next = readActive(cookiesRef.current);
    if (next !== activeId) setActiveId(next);
  }, [itemIds, activeId, storageKey]);

  return (
    <div className={className}>
      <div className='flex flex-wrap gap-3 text-sm'>
        {items.map((item) => (
          <ToggleBadge key={item.id} active={activeId === item.id} onClick={() => handleToggle(item.id)}>
            {item.label}
          </ToggleBadge>
        ))}
      </div>
      {children(activeId)}
    </div>
  );
}
