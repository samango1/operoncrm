'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';

import { getCompanies, getTransactions } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import TransactionForm from '@/components/Forms/TransactionForm';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [companyPaging, setCompanyPaging] = useState<Record<string, { page: number; pageSize: number }>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, companiesRes] = await Promise.all([
        getTransactions({ page: 1, page_size: 10000 }),
        getCompanies({ page: 1, page_size: 1000 }),
      ]);
      setTransactions(txRes.results ?? txRes);
      setCompanies(companiesRes.results ?? companiesRes);
      const initialPaging: Record<string, { page: number; pageSize: number }> = {};
      (companiesRes.results ?? companiesRes).forEach((c: Company) => {
        initialPaging[String(c.id)] = { page: 1, pageSize: 10 };
      });
      setCompanyPaging((prev) => ({ ...initialPaging, ...prev }));
    } catch (err) {
      console.error('fetchAll transactions error:', err);
      setError('Не удалось загрузить транзакции или компании');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    transactions.forEach((t) => {
      const cid = typeof t.company === 'string' ? t.company : String(t.company?.id ?? t.company);
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(t);
    });
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (b.date ?? b.created_at ?? '').localeCompare(a.date ?? a.created_at ?? ''));
      map.set(k, arr);
    }
    return map;
  }, [transactions]);

  const resolveCompany = (companyId: string): Company | undefined => {
    return companies.find((c) => String(c.id) === String(companyId));
  };

  const formatAmount = (amount?: number | string) => {
    if (amount === undefined || amount === null || amount === '') return '';
    const raw = typeof amount === 'number' ? amount : String(amount).trim();
    const parsed = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '.'));
    if (Number.isFinite(parsed)) {
      const frac = String(parsed).includes('.') ? { minimumFractionDigits: 2, maximumFractionDigits: 8 } : {};
      try {
        return parsed.toLocaleString('ru-RU', frac as Intl.NumberFormatOptions);
      } catch {
        return String(parsed);
      }
    }
    return String(raw);
  };

  const columns: Column<Transaction>[] = [
    {
      key: 'date',
      label: 'Дата',
      render: (r) => ((r.date ?? r.created_at) ? String(r.date ?? r.created_at).slice(0, 10) : ''),
    },
    { key: 'type', label: 'Тип', render: (r) => r.type },
    {
      key: 'amount_currency',
      label: 'Сумма',
      render: (r) => {
        const amt = r.initial_amount ?? r.amount ?? '';
        const formatted = formatAmount(amt);
        const currency = r.currency ?? '';
        return [formatted, currency].filter(Boolean).join(' ');
      },
    },
    {
      key: 'client',
      label: 'Клиент',
      render: (r) => {
        if (!r.client) return '';
        if (typeof r.client === 'string') return r.client;
        return (r.client as any).name ?? (r.client as any).phone ?? String((r.client as any).id ?? '');
      },
    },
  ];

  const openCreate = () => {
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
  };

  const onCreated = async () => {
    await fetchAll();
  };

  const handleCompanyPageChange = (companyId: string, page: number, newPageSize?: number) => {
    setCompanyPaging((prev) => {
      const cur = prev[companyId] ?? { page: 1, pageSize: 10 };
      const ns = newPageSize ?? cur.pageSize;
      return { ...prev, [companyId]: { page, pageSize: ns } };
    });
  };

  const filteredCompanyIds = useMemo(() => {
    const groupedKeys = Array.from(grouped.keys());
    if (!globalSearch || globalSearch.trim() === '') {
      return groupedKeys;
    }
    const q = globalSearch.trim().toLowerCase();
    return groupedKeys.filter((cid) => {
      const comp = resolveCompany(cid);
      const compText = [comp?.name ?? '', comp?.slug ?? '', cid].join(' ').toLowerCase();
      const txs = grouped.get(cid) ?? [];
      const txText = txs
        .map((t) => `${t.description ?? ''} ${typeof t.client === 'string' ? t.client : ((t.client as any)?.name ?? '')}`)
        .join(' ')
        .toLowerCase();
      return compText.includes(q) || txText.includes(q);
    });
  }, [globalSearch, grouped, companies]);

  return (
    <main className='p-6 max-w-6xl mx-auto'>
      <header className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Транзакции</h1>
          <p className='text-sm text-gray-500'>Всего транзакций: {transactions.length}</p>
        </div>

        <ButtonDefault onClick={openCreate} variant='positive'>
          Добавить
        </ButtonDefault>
      </header>

      <div className='mb-4'>
        <SearchInput
          initialValue={globalSearch}
          onSearch={(q) => setGlobalSearch(q)}
          placeholder='Поиск по компании, описанию, клиенту...'
        />
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      <section className='space-y-8'>
        {loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
        ) : filteredCompanyIds.length === 0 ? (
          <div className='text-gray-600'>Нет транзакций, соответствующих запросу.</div>
        ) : (
          filteredCompanyIds.map((companyId) => {
            const txs = grouped.get(companyId) ?? [];
            const comp = resolveCompany(companyId);
            const paging = companyPaging[companyId] ?? { page: 1, pageSize: 10 };
            const start = (paging.page - 1) * paging.pageSize;
            const pageSlice = txs.slice(start, start + paging.pageSize);

            return (
              <div key={companyId} className='bg-white/5 rounded p-4'>
                <div className='flex justify-between items-center mb-3'>
                  <div>
                    <h2 className='text-lg font-medium'>{comp ? comp.name : `Компания ${companyId}`}</h2>
                    <div className='text-sm text-gray-500'>Транзакций: {txs.length}</div>
                  </div>
                  <div className='text-sm text-gray-600'>
                    <span className='mr-2'>Показано: {Math.min(txs.length, paging.pageSize)}</span>
                  </div>
                </div>

                <TableDefault<Transaction> columns={columns} data={pageSlice} className='bg-transparent' />

                <div className='mt-3'>
                  <Pagination
                    currentPage={paging.page}
                    pageSize={paging.pageSize}
                    total={txs.length}
                    onPageChange={(page, newSize) => handleCompanyPageChange(companyId, page, newSize)}
                  />
                </div>
              </div>
            );
          })
        )}
      </section>

      <ModalWindowDefault isOpen={isCreateOpen} onClose={closeCreate} showCloseIcon>
        <div>
          <h2 className='text-xl font-semibold mb-4'>Новая транзакция</h2>

          <TransactionForm companies={companies} onCancel={closeCreate} onSuccess={onCreated} />
        </div>
      </ModalWindowDefault>
    </main>
  );
}
