'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import type { Client } from '@/types/api/clients';

import { getCompanies, getCompanyTransactions, getClients, getCompanyTransactionById } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import TransactionForm from '@/components/Forms/TransactionForm';

import { Pencil, Eye } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    try {
      const companiesRes = await getCompanies({ page: 1, page_size: 1000 });
      setCompanies(companiesRes.results as Company[]);
    } catch (err) {
      console.error('fetchCompanies error:', err);
      setError('Не удалось загрузить компании');
    }
  };

  const fetchClients = async () => {
    try {
      const clientsRes = await getClients({ page: 1, page_size: 1000 });
      setClients(clientsRes.results as Client[]);
    } catch (err) {
      console.error('fetchClients error:', err);
    }
  };

  const fetchTransactions = async (companyId: string, page = currentPage, ps = pageSize, search = globalSearch) => {
    if (!companyId) {
      setTransactions([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const txRes = await getCompanyTransactions(companyId, { page, page_size: ps, search });
      setTransactions(txRes.results as Transaction[]);
      setTotalCount(txRes.count);
    } catch (err) {
      console.error('fetchTransactions error:', err);
      setError('Не удалось загрузить транзакции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchTransactions(selectedCompanyId, currentPage, pageSize, globalSearch);
    } else {
      setTransactions([]);
      setTotalCount(0);
    }
  }, [selectedCompanyId, currentPage, pageSize, globalSearch]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [selectedCompanyId, companies]);

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
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionById(selectedCompanyId, txId);
      setSelectedTransaction(item as Transaction);
    } catch (err) {
      console.error('getCompanyTransactionById error:', err);
      setModalError('Не удалось загрузить транзакцию');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (txId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionById(selectedCompanyId, txId);
      setSelectedTransaction(item as Transaction);
    } catch (err) {
      console.error('getCompanyTransactionById error:', err);
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
    if (selectedCompanyId) await fetchTransactions(selectedCompanyId, currentPage, pageSize, globalSearch);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  const handleSearch = (q: string) => {
    setGlobalSearch(q);
    setCurrentPage(1);
  };

  const companyOptions = useMemo(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name || c.slug || String(c.id),
    }));
  }, [companies]);

  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Транзакции</h1>
          <p className='text-sm text-gray-500'>
            {selectedCompanyId ? `Всего транзакций: ${totalCount}` : 'Выберите компанию для просмотра транзакций'}
          </p>
        </div>

        <ButtonDefault
          type='button'
          variant='positive'
          onClick={() => {
            if (!selectedCompanyId) {
              alert('Сначала выберите компанию');
              return;
            }
            openCreate();
          }}
        >
          Добавить
        </ButtonDefault>
      </section>

      <div className='mb-4 space-y-4'>
        <div>
          <SelectOption
            label='Компания'
            placeholder='Выберите компанию'
            options={companyOptions}
            value={selectedCompanyId}
            onChange={(value) => {
              setSelectedCompanyId(value);
              setCurrentPage(1);
              setGlobalSearch('');
            }}
          />
        </div>

        {selectedCompanyId && (
          <SearchInput initialValue={globalSearch} onSearch={handleSearch} placeholder='Поиск по описанию, клиенту...' />
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>Выберите компанию для просмотра транзакций</div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : transactions.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет транзакций, соответствующих запросу.' : 'Нет транзакций для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
          <div className='flex justify-between items-center mb-3'>
            <div>
              <h2 className='text-lg font-medium'>{selectedCompany?.name || `Компания ${selectedCompanyId}`}</h2>
              <div className='text-sm text-gray-500'>Транзакций: {totalCount}</div>
            </div>
          </div>

          <TableDefault<Transaction> columns={columns} data={transactions} className='bg-transparent' />

          <div className='mt-3'>
            <Pagination currentPage={currentPage} pageSize={pageSize} total={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>
      )}

      <ModalWindowDefault isOpen={isCreateOpen} onClose={closeCreate} showCloseIcon>
        <div>
          <h2 className='text-xl font-semibold mb-4'>Новая транзакция</h2>

          <TransactionForm
            companies={companies}
            clients={clients}
            defaultCompanyId={selectedCompanyId}
            onCancel={closeCreate}
            onSuccess={onCreated}
          />
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
                    if (selectedCompanyId) {
                      await fetchTransactions(selectedCompanyId, currentPage, pageSize, globalSearch);
                    }
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
    </>
  );
}
