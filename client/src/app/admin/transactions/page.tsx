'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import type { Client } from '@/types/api/clients';

import { getCompanies, getTransactions, getClients, getTransactionById } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import TransactionForm from '@/components/Forms/TransactionForm';

import { Pencil, Eye } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [globalSearch, setGlobalSearch] = useState<string>('');

  const [companyPaging, setCompanyPaging] = useState<Record<string, { page: number; pageSize: number }>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, companiesRes, clientsRes] = await Promise.all([
        getTransactions({ page: 1, page_size: 10000 }),
        getCompanies({ page: 1, page_size: 1000 }),
        getClients({ page: 1, page_size: 1000 }),
      ]);
      setTransactions(txRes.results as Transaction[]);
      setCompanies(companiesRes.results as Company[]);
      setClients(clientsRes.results as Client[]);
      const initialPaging: Record<string, { page: number; pageSize: number }> = {};
      (companiesRes.results as Company[]).forEach((c: Company) => {
        initialPaging[String(c.id)] = { page: 1, pageSize: 10 };
      });
      setCompanyPaging((prev) => ({ ...initialPaging, ...prev }));
    } catch (err) {
      console.error('fetchAll transactions error:', err);
      setError('Не удалось загрузить транзакции, компании или клиентов');
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
      const cid = typeof t.company === 'string' ? t.company : String((t.company as Company)?.id ?? t.company);
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

  const openViewModal = async (txId: string) => {
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getTransactionById(txId);
      setSelectedTransaction(item as Transaction);
    } catch (err) {
      console.error('getTransactionById error:', err);
      setModalError('Не удалось загрузить транзакцию');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (txId: string) => {
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getTransactionById(txId);
      setSelectedTransaction(item as Transaction);
    } catch (err) {
      console.error('getTransactionById error:', err);
      setModalError('Не удалось загрузить транзакцию');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
    setModalError(null);
    setIsEditing(false);
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
        const clientObj = r.client as Client;
        return clientObj.name ?? clientObj.phone ?? String(clientObj.id ?? '');
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Transaction) => (
        <div className='flex gap-2'>
          <ButtonDefault
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              openViewModal(String(row.id));
            }}
            type='button'
          >
            <Eye />
          </ButtonDefault>

          <ButtonDefault
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              openEditModal(String(row.id));
            }}
            type='button'
          >
            <Pencil />
          </ButtonDefault>
        </div>
      ),
      className: 'w-40',
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
        .map((t) => {
          const clientPart = typeof t.client === 'string' ? t.client : (t.client?.name ?? '');
          return `${t.description ?? ''} ${clientPart}`;
        })
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

          <TransactionForm companies={companies} clients={clients} onCancel={closeCreate} onSuccess={onCreated} />
        </div>
      </ModalWindowDefault>

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>
                {selectedTransaction ? 'Редактирование транзакции' : 'Загрузка транзакции...'}
              </h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedTransaction && (
                <TransactionForm
                  transaction={selectedTransaction}
                  companies={companies}
                  clients={clients}
                  defaultCompanyId={
                    typeof selectedTransaction.company === 'string'
                      ? selectedTransaction.company
                      : ((selectedTransaction.company as Company)?.id ?? '')
                  }
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    await fetchAll();
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр транзакции</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedTransaction && (
                <div className='space-y-2 text-sm text-gray-800'>
                  <div>
                    <strong>ID:</strong> {selectedTransaction.id}
                  </div>
                  <div>
                    <strong>Дата:</strong> {(selectedTransaction.date ?? selectedTransaction.created_at ?? '').slice(0, 10)}
                  </div>
                  <div>
                    <strong>Тип:</strong> {selectedTransaction.type}
                  </div>
                  <div>
                    <strong>Сумма:</strong> {formatAmount(selectedTransaction.initial_amount ?? selectedTransaction.amount)}{' '}
                    {selectedTransaction.currency}
                  </div>
                  <div>
                    <strong>Клиент:</strong>{' '}
                    {selectedTransaction.client
                      ? typeof selectedTransaction.client === 'string'
                        ? selectedTransaction.client
                        : ((selectedTransaction.client as Client).name ??
                          (selectedTransaction.client as Client).phone ??
                          String((selectedTransaction.client as Client).id))
                      : ''}
                  </div>
                  <div>
                    <strong>Компания:</strong>{' '}
                    {selectedTransaction.company
                      ? typeof selectedTransaction.company === 'string'
                        ? selectedTransaction.company
                        : ((selectedTransaction.company as Company).name ?? String((selectedTransaction.company as Company).id))
                      : ''}
                  </div>
                  <div>
                    <strong>Описание:</strong> {selectedTransaction.description ?? ''}
                  </div>
                  <div>
                    <strong>Создан:</strong> {selectedTransaction.created_at ?? ''}
                  </div>
                  <div>
                    <strong>Обновлен:</strong> {selectedTransaction.updated_at ?? ''}
                  </div>
                  <div>
                    <strong>Недействительная:</strong> {selectedTransaction.invalid ? 'Да' : 'Нет'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ModalWindowDefault>
    </main>
  );
}
