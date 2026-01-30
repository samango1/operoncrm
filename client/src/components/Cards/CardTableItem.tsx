import React from 'react';
import clsx from 'clsx';
import type { Column } from '@/components/Tables/TableDefault';

interface CardTableItemProps<T> {
  columns: Column<T>[];
  row: T;
  rowIndex: number;
  onCellClick?: (row: T, key: keyof T | string, value: any, rowIndex: number, colIndex: number) => void;
  onRowClick?: (row: T, rowIndex: number) => void;
  rowClassName?: string;
}

export default function CardTableItem<T extends Record<string, any>>({
  columns,
  row,
  rowIndex,
  onCellClick,
  onRowClick,
  rowClassName,
}: CardTableItemProps<T>) {
  const renderCellContent = (col: Column<T>, colIndex: number) => {
    const rawValue = (row as any)[col.key];
    const hasRender = typeof col.render === 'function';

    return hasRender
      ? col.render!(row, rowIndex, colIndex)
      : rawValue === null || rawValue === undefined
        ? ''
        : String(rawValue);
  };

  return (
    <div
      className={clsx(
        'rounded-xl border border-gray-200 p-3 shadow-sm space-y-3',
        onRowClick && 'cursor-pointer',
        rowClassName ?? 'bg-white'
      )}
      onClick={() => onRowClick?.(row, rowIndex)}
    >
      {columns.map((col, cIdx) => {
        const rawValue = (row as any)[col.key];
        const hasRender = typeof col.render === 'function';
        const isClickable = Boolean((col.onClick || onCellClick) && !hasRender);

        const invoke = () => {
          if (col.onClick) {
            col.onClick(row, col.key, rawValue, rowIndex, cIdx);
          } else if (onCellClick) {
            onCellClick(row, col.key, rawValue, rowIndex, cIdx);
          }
        };

        const handleClick = (e: React.MouseEvent) => {
          if (!isClickable) return;
          e.stopPropagation();
          invoke();
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (!isClickable) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            invoke();
          }
        };

        return (
          <div key={`${String(col.key)}-${cIdx}`} className='flex items-start justify-between gap-4'>
            <div className='text-xs font-semibold uppercase tracking-wider text-gray-500'>{col.label}</div>
            <div
              className={clsx('text-sm text-gray-900 text-right', isClickable && 'cursor-pointer select-none')}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? handleClick : undefined}
              onKeyDown={handleKeyDown}
            >
              {renderCellContent(col, cIdx)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
