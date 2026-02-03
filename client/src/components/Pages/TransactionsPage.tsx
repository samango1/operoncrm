'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import type { Client } from '@/types/api/clients';
import type { PlatformRole } from '@/types/api/users';
import type { Product } from '@/types/api/products';
import type { Service } from '@/types/api/services';

import {
  getCompanies,
  getCompanyBySlug,
  getCompanyTransactions,
  getCompanyClients,
  getClients,
  getCompanyTransactionById,
  getCompanyProducts,
  getCompanyServices,
} from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { getPlatformRoleFromCookie } from '@/lib/role';
import { formatMoney } from '@/lib/decimal';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import TransactionForm from '@/components/Forms/TransactionForm';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';

import { Pencil, Eye, Funnel } from 'lucide-react';

type TransactionsPageProps = {
  tenantSlug?: string;
};

export default function TransactionsPage({ tenantSlug }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [validOnly, setValidOnly] = useState<boolean | null>(null);
  const [role, setRole] = useState<PlatformRole | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const isTenantMode = Boolean(tenantSlug);

  const fetchCompanies = async () => {
    try {
      const companiesRes = await getCompanies({ page: 1, page_size: 1000 });
      setCompanies(companiesRes.results as Company[]);
    } catch (err) {
      console.error('fetchCompanies error:', err);
      setError('Не удалось загрузить компании');
    }
  };

  const fetchClients = async (companyId?: string) => {
    if (isTenantMode && !companyId) {
      setClients([]);
      return;
    }
    try {
      const clientsRes = isTenantMode
        ? await getCompanyClients(String(companyId), { page: 1, page_size: 1000 })
        : await getClients({ page: 1, page_size: 1000 });
      setClients(clientsRes.results as Client[]);
    } catch (err) {
      console.error('fetchClients error:', err);
    }
  };

  const fetchTransactions = async (
    companyId: string,
    page = currentPage,
    ps = pageSize,
    search = globalSearch,
    valid = validOnly
  ) => {
    if (!companyId) {
      setTransactions([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const txRes = await getCompanyTransactions(companyId, { page, page_size: ps, search, valid: valid ?? undefined });
      setTransactions(txRes.results as Transaction[]);
      setTotalCount(txRes.count);
    } catch (err) {
      console.error('fetchTransactions error:', err);
      setError('Не удалось загрузить транзакции');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (companyId: string) => {
    try {
      const res = await getCompanyProducts(companyId, { page: 1, page_size: 1000 });
      setProducts(res.results as Product[]);
    } catch (err) {
      console.error('fetchProducts error:', err);
      setProducts([]);
    }
  };

  const fetchServices = async (companyId: string) => {
    try {
      const res = await getCompanyServices(companyId, { page: 1, page_size: 1000 });
      setServices(res.results as Service[]);
    } catch (err) {
      console.error('fetchServices error:', err);
      setServices([]);
    }
  };

  useEffect(() => {
    if (isTenantMode) return;
    fetchCompanies();
    fetchClients();
  }, [isTenantMode]);

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchTenantCompany = async () => {
      setCompanyLoading(true);
      setError(null);
      setTenantCompany(null);
      setSelectedCompanyId(undefined);
      setCompanies([]);
      try {
        const companyRes = await getCompanyBySlug(tenantSlug);
        setTenantCompany(companyRes as Company);
        setSelectedCompanyId(companyRes?.id ? String(companyRes.id) : undefined);
        setCompanies(companyRes ? [companyRes as Company] : []);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setError('Не удалось загрузить компанию');
        setTenantCompany(null);
        setSelectedCompanyId(undefined);
        setCompanies([]);
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchTenantCompany();
  }, [tenantSlug]);

  useEffect(() => {
    const resolvedRole = getPlatformRoleFromCookie();
    setRole(resolvedRole);
  }, []);

  useEffect(() => {
    if (isTenantMode) {
      setValidOnly(null);
      return;
    }
    if (role === 'member') {
      setValidOnly(null);
      return;
    }
    if (role) {
      setValidOnly((prev) => (prev === null ? true : prev));
    }
  }, [role, isTenantMode]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchTransactions(selectedCompanyId, currentPage, pageSize, globalSearch, validOnly);
    } else {
      setTransactions([]);
      setTotalCount(0);
    }
  }, [selectedCompanyId, currentPage, pageSize, globalSearch, validOnly]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchProducts(selectedCompanyId);
      fetchServices(selectedCompanyId);
    } else {
      setProducts([]);
      setServices([]);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!isTenantMode) return;
    if (!selectedCompanyId) {
      setClients([]);
      return;
    }
    fetchClients(selectedCompanyId);
  }, [isTenantMode, selectedCompanyId]);

  const selectedCompany = useMemo(() => {
    if (isTenantMode) return tenantCompany ?? undefined;
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [isTenantMode, tenantCompany, selectedCompanyId, companies]);

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

  const formatServiceNames = (items?: Transaction['services']) => {
    if (!items || items.length === 0) return '';
    return (items as Array<string | { id?: string; name?: string }>)
      .map((s) => {
        if (typeof s === 'string') return s;
        return s.name ?? String(s.id ?? '');
      })
      .filter(Boolean)
      .join(', ');
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
    {
      key: 'amount_currency',
      label: 'Сумма',
      render: (r) => {
        const amt = isTenantMode ? (r.initial_amount ?? r.amount ?? '') : (r.amount ?? '');
        const formatted = formatMoney(amt);
        if (formatted === '') return '';
        const currency = r.currency ?? '';
        const display = [formatted, currency].filter(Boolean).join(' ');
        const isIncome = r.type === 'income';
        const sign = isIncome ? '+' : '-';
        const colorClass = isIncome ? 'text-green-600' : 'text-red-600';
        return <span className={`font-bold ${colorClass}`}>{`${sign}${display}`}</span>;
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

  const headerSubtitle = isTenantMode
    ? companyLoading
      ? 'Загрузка компании...'
      : selectedCompanyId
        ? `Всего транзакций: ${totalCount}`
        : 'Компания не найдена'
    : selectedCompanyId
      ? `Всего транзакций: ${totalCount}`
      : 'Выберите компанию для просмотра транзакций';

  const showValidSwitch = !isTenantMode && (role === 'admin' || role === 'agent');

  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Транзакции</h1>
          <p className='text-sm text-gray-500'>{headerSubtitle}</p>
        </div>

        <ButtonDefault
          type='button'
          variant='positive'
          onClick={() => {
            if (!selectedCompanyId) {
              alert(isTenantMode ? 'Компания не найдена' : 'Сначала выберите компанию');
              return;
            }
            openCreate();
          }}
        >
          Добавить
        </ButtonDefault>
      </section>

      <div className='mb-4 space-y-4'>
        {!isTenantMode && (
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
        )}

        {selectedCompanyId && (
          <>
            <div className='flex items-center justify-between gap-4'>
              <SearchInput
                initialValue={globalSearch}
                onSearch={handleSearch}
                placeholder='Поиск по описанию, типу, методу, валюте, суммам, категориям'
              />
              {!isTenantMode && (
                <ButtonDefault
                  type='button'
                  onClick={() => setShowFilters((v) => !v)}
                  aria-label='Показать фильтры'
                  variant={showFilters ? 'positive' : 'outline'}
                >
                  <Funnel />
                </ButtonDefault>
              )}
            </div>
            {!isTenantMode && showFilters && (
              <div className='rounded-lg border border-gray-200 bg-white/60 p-3'>
                {showValidSwitch && validOnly !== null && (
                  <ToggleSwitch
                    checked={validOnly}
                    onChange={(next) => {
                      setValidOnly(next);
                      setCurrentPage(1);
                    }}
                    label='Показывать'
                    onLabel='Валидные'
                    offLabel='Невалидные'
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {isTenantMode ? 'Компания не найдена' : 'Выберите компанию для просмотра транзакций'}
        </div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : transactions.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет транзакций, соответствующих запросу.' : 'Нет транзакций для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
          {!isTenantMode && (
            <div className='flex justify-between items-center mb-3'>
              <div>
                <h2 className='text-lg font-medium'>{selectedCompany?.name || `Компания ${selectedCompanyId}`}</h2>
                <div className='text-sm text-gray-500'>Транзакций: {totalCount}</div>
              </div>
            </div>
          )}

          <TableDefault<Transaction>
            columns={columns}
            data={transactions}
            className='bg-transparent'
            rowClassName={validOnly === false ? 'bg-red-100 hover:bg-red-200' : undefined}
          />

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
            services={services}
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
                  products={products}
                  services={services}
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
                    <strong>Сумма:</strong>{' '}
                    {formatMoney(
                      isTenantMode
                        ? (selectedTransaction.initial_amount ?? selectedTransaction.amount)
                        : selectedTransaction.amount
                    )}{' '}
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
                    <strong>Услуги:</strong> {formatServiceNames(selectedTransaction.services)}
                  </div>
                  <div>
                    <strong>Начало услуг:</strong>{' '}
                    {selectedTransaction.services_starts_at ? String(selectedTransaction.services_starts_at).slice(0, 16) : ''}
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
