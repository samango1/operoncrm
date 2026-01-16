import React from 'react';
import clsx from 'clsx';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  onClick?: (row: T, key: keyof T | string, value: any, rowIndex: number, colIndex: number) => void;
  className?: string;
  render?: (row: T, rowIndex?: number, colIndex?: number) => React.ReactNode;
}

interface TableDefaultProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  onCellClick?: (row: T, key: keyof T | string, value: any, rowIndex: number, colIndex: number) => void;
  onRowClick?: (row: T, rowIndex: number) => void;
}

export default function TableDefault<T extends Record<string, any>>({
  columns,
  data,
  className,
  onCellClick,
  onRowClick,
}: TableDefaultProps<T>) {
  return (
    <div className={clsx('overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200', className)}>
      <table className='min-w-full divide-y divide-gray-200'>
        <thead className='bg-gray-50'>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className='px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider'
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {data.map((row, rIdx) => (
            <tr
              key={rIdx}
              className='hover:bg-gray-100 transition-colors duration-200 cursor-default'
              onClick={() => onRowClick?.(row, rIdx)}
            >
              {columns.map((col, cIdx) => {
                const rawValue = (row as any)[col.key];
                const hasRender = typeof col.render === 'function';

                const isClickable = Boolean((col.onClick || onCellClick) && !hasRender);

                const invoke = () => {
                  if (col.onClick) {
                    col.onClick(row, col.key, rawValue, rIdx, cIdx);
                  } else if (onCellClick) {
                    onCellClick(row, col.key, rawValue, rIdx, cIdx);
                  }
                };

                const handleClick = (e: React.MouseEvent) => {
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

                const content = hasRender
                  ? col.render!(row, rIdx, cIdx)
                  : rawValue === null || rawValue === undefined
                    ? ''
                    : String(rawValue);

                return (
                  <td
                    key={`${String(col.key)}-${cIdx}`}
                    className={clsx(
                      'px-6 py-4 text-sm text-gray-900 align-top',
                      col.className,
                      isClickable && 'cursor-pointer select-none'
                    )}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? handleClick : undefined}
                    onKeyDown={handleKeyDown}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
