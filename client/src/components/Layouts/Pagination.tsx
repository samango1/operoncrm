'use client';

type PaginationProps = {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize?: number) => void;
  pageSizeOptions?: number[];
  siblingCount?: number;
  className?: string;
};

function range(from: number, to: number) {
  const res: number[] = [];
  for (let i = from; i <= to; i++) res.push(i);
  return res;
}

type PrevNextButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel: string;
};

const PrevNextButton = ({ onClick, disabled, children, ariaLabel }: PrevNextButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className='w-8 h-8 flex items-center justify-center rounded-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-200 transition'
  >
    {children}
  </button>
);

type PageButtonProps = {
  page: number;
  currentPage: number;
  onClick: (page: number) => void;
};

const PageButton = ({ page, currentPage, onClick }: PageButtonProps) => (
  <button
    onClick={() => onClick(page)}
    aria-current={page === currentPage ? 'page' : undefined}
    className={`w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition ${
      page === currentPage ? 'bg-gray-300 font-semibold' : 'hover:bg-gray-100'
    }`}
  >
    {page}
  </button>
);

type PageSizeSelectProps = {
  pageSize: number;
  options: number[];
  onChange: (value: number) => void;
};

const PageSizeSelect = ({ pageSize, options, onChange }: PageSizeSelectProps) => (
  <select
    value={pageSize}
    onChange={(e) => onChange(Number(e.target.value))}
    className='px-2 py-1 bg-white cursor-pointer border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400'
  >
    {options.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
);

export default function Pagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = [1, 10, 25, 50],
  siblingCount = 0,
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePrev = () => currentPage > 1 && onPageChange(currentPage - 1);
  const handleNext = () => currentPage < totalPages && onPageChange(currentPage + 1);

  const paginationItems = (() => {
    const pages: (number | 'dots')[] = [];
    const left = Math.max(1, currentPage - siblingCount);
    const right = Math.min(totalPages, currentPage + siblingCount);

    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push('dots');
    }

    pages.push(...range(left, right));

    if (right < totalPages) {
      if (right < totalPages - 1) pages.push('dots');
      pages.push(totalPages);
    }

    return pages;
  })();

  return (
    <nav className={`flex items-center justify-between gap-4 font-sans text-sm ${className}`} aria-label='Pagination'>
      <div className='flex items-center gap-1'>
        <PrevNextButton onClick={handlePrev} disabled={currentPage === 1} ariaLabel='Previous page'>
          ‹
        </PrevNextButton>

        {paginationItems.map((p, idx) =>
          p === 'dots' ? (
            <span key={`dots-${idx}`} className='px-2 select-none text-gray-400'>
              …
            </span>
          ) : (
            <PageButton key={`page-${p}`} page={p} currentPage={currentPage} onClick={onPageChange} />
          )
        )}

        <PrevNextButton onClick={handleNext} disabled={currentPage === totalPages} ariaLabel='Next page'>
          ›
        </PrevNextButton>
      </div>

      <PageSizeSelect pageSize={pageSize} options={pageSizeOptions} onChange={(value) => onPageChange(1, value)} />
    </nav>
  );
}
