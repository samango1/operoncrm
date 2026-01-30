'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Transaction } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import type { Client } from '@/types/api/clients';
import type { Product } from '@/types/api/products';

import {
  getCompanyBySlug,
  getCompanyTransactions,
  getCompanyClients,
  getCompanyTransactionById,
  getCompanyProducts,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import TransactionForm from '@/components/Forms/TransactionForm';

import { Pencil, Eye } from 'lucide-react';

export default function TenantTransactionsPage() {
  const params = useParams<{ tenant: string }>();
  const [slug, setSlug] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;
    if (tenantValue) {
      setSlug(String(tenantValue));
    }
  }, [params?.tenant]);

  const fetchCompany = async (tenantSlug: string) => {
    setCompanyLoading(true);
    setError(null);
    try {
      const companyResp = await getCompanyBySlug(tenantSlug);
      setCompany(companyResp);
      setCompanyId(companyResp?.id ? String(companyResp.id) : undefined);
    } catch (err) {
      console.error('getCompanyBySlug error:', err);
      setError('Не удалось загрузить компанию');
      setCompany(null);
      setCompanyId(undefined);
    } finally {
      setCompanyLoading(false);
    }
  };

  const fetchClients = async (id: string) => {
    try {
      const clientsRes = await getCompanyClients(id, { page: 1, page_size: 1000 });
      setClients(clientsRes.results as Client[]);
    } catch (err) {
      console.error('fetchClients error:', err);
    }
  };

  const fetchProducts = async (id: string) => {
    try {
      const productsRes = await getCompanyProducts(id, { page: 1, page_size: 1000 });
      setProducts(productsRes.results as Product[]);
    } catch (err) {
      console.error('fetchProducts error:', err);
    }
  };

  const fetchTransactions = async (id: string, page = currentPage, ps = pageSize, search = globalSearch) => {
    if (!id) {
      setTransactions([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const txRes = await getCompanyTransactions(id, { page, page_size: ps, search });
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
    if (!slug) return;
    fetchCompany(slug);
  }, [slug]);

  useEffect(() => {
    if (!companyId) {
      setClients([]);
      setProducts([]);
      return;
    }
    fetchClients(companyId);
    fetchProducts(companyId);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setTransactions([]);
      setTotalCount(0);
      return;
    }
    fetchTransactions(companyId, currentPage, pageSize, globalSearch);
  }, [companyId, currentPage, pageSize, globalSearch]);

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

  const formatCategoryNames = (cats?: Transaction['categories']) => {
    if (!cats || cats.length === 0) return '';
    return (cats as Array<string | { id?: string; name?: string }>)
      .map((c) => {
        if (typeof c === 'string') return c;
        return c.name ?? String(c.id ?? '');
      })
      .filter(Boolean)
      .join(', ');
  };

  const formatProductNames = (items?: Transaction['products']) => {
    if (!items || items.length === 0) return '';
    return (items as Array<string | { id?: string; name?: string }>)
      .map((p) => {
        if (typeof p === 'string') return p;
        return p.name ?? String(p.id ?? '');
      })
      .filter(Boolean)
      .join(', ');
  };

  const openViewModal = async (txId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionById(companyId, txId);
      setSelectedTransaction(item as Transaction);
    } catch (err) {
      console.error('getCompanyTransactionById error:', err);
      setModalError('Не удалось загрузить транзакцию');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (txId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedTransaction(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionById(companyId, txId);
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
        const phone = formatPhoneDisplay(String(clientObj.phone ?? ''));
        return clientObj.name ?? (phone || String(clientObj.id ?? ''));
      },
    },
    {
      key: 'actions',
      label: 'Действия',
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
    if (companyId) await fetchTransactions(companyId, currentPage, pageSize, globalSearch);
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

  const companies = useMemo(() => (company ? [company] : []), [company]);

  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Транзакции</h1>
          <p className='text-sm text-gray-500'>
            {companyId ? `Всего транзакций: ${totalCount}` : companyLoading ? 'Загрузка компании...' : 'Компания не найдена'}
          </p>
        </div>

        <ButtonDefault
          type='button'
          variant='positive'
          onClick={() => {
            if (!companyId) {
              alert('Компания не найдена');
              return;
            }
            openCreate();
          }}
        >
          Добавить
        </ButtonDefault>
      </section>

      <div className='mb-4'>
        {companyId && (
          <SearchInput
            initialValue={globalSearch}
            onSearch={handleSearch}
            placeholder='Поиск по описанию, типу, методу, валюте, суммам, категориям'
          />
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!companyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>Компания не найдена</div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : transactions.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет транзакций, соответствующих запросу.' : 'Нет транзакций для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
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
            products={products}
            defaultCompanyId={companyId}
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
                  products={products}
                  defaultCompanyId={
                    typeof selectedTransaction.company === 'string'
                      ? selectedTransaction.company
                      : ((selectedTransaction.company as Company)?.id ?? '')
                  }
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (companyId) {
                      await fetchTransactions(companyId, currentPage, pageSize, globalSearch);
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
                    <strong>Категории:</strong> {formatCategoryNames(selectedTransaction.categories)}
                  </div>
                  <div>
                    <strong>Продукты:</strong> {formatProductNames(selectedTransaction.products)}
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
                    <strong>Действительная:</strong> {selectedTransaction.valid ? 'Да' : 'Нет'}
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
