'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { TransactionCategory } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import { getCompanies, getCompanyTransactionCategories, getCompanyTransactionCategoryById } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import TransactionCategoryForm from '@/components/Forms/TransactionCategoryForm';

import { Pencil, Eye } from 'lucide-react';

export default function TransactionCategoriesPage() {
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
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

  const fetchCategories = async (companyId: string, page = currentPage, ps = pageSize, search = globalSearch) => {
    if (!companyId) {
      setCategories([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyTransactionCategories(companyId, { page, page_size: ps, search });
      setCategories(res.results as TransactionCategory[]);
      setTotalCount(res.count);
    } catch (err) {
      console.error('fetchCategories error:', err);
      setError('Не удалось загрузить категории');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCategories(selectedCompanyId, currentPage, pageSize, globalSearch);
    } else {
      setCategories([]);
      setTotalCount(0);
    }
  }, [selectedCompanyId, currentPage, pageSize, globalSearch]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [selectedCompanyId, companies]);

  const openViewModal = async (categoryId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedCategory(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionCategoryById(selectedCompanyId, categoryId);
      setSelectedCategory(item as TransactionCategory);
    } catch (err) {
      console.error('getCompanyTransactionCategoryById error:', err);
      setModalError('Не удалось загрузить категорию');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (categoryId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedCategory(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyTransactionCategoryById(selectedCompanyId, categoryId);
      setSelectedCategory(item as TransactionCategory);
    } catch (err) {
      console.error('getCompanyTransactionCategoryById error:', err);
      setModalError('Не удалось загрузить категорию');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setModalError(null);
    setIsEditing(false);
  };

  const columns: Column<TransactionCategory>[] = [
    { key: 'name', label: 'Название' },
    {
      key: 'created_by',
      label: 'Создал',
      render: (r: TransactionCategory) => {
        if (!r.created_by) return '';
        if (typeof r.created_by === 'string') return r.created_by;
        return r.created_by.name ?? String(r.created_by.id ?? '');
      },
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (row: TransactionCategory) => (
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
    if (selectedCompanyId) await fetchCategories(selectedCompanyId, currentPage, pageSize, globalSearch);
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
          <h1 className='text-2xl font-semibold'>Категории транзакций</h1>
          <p className='text-sm text-gray-500'>
            {selectedCompanyId ? `Всего категорий: ${totalCount}` : 'Выберите компанию для просмотра категорий'}
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
          <SearchInput initialValue={globalSearch} onSearch={handleSearch} placeholder='Поиск по названию' />
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>Выберите компанию для просмотра категорий</div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет категорий, соответствующих запросу.' : 'Нет категорий для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
          <div className='flex justify-between items-center mb-3'>
            <div>
              <h2 className='text-lg font-medium'>{selectedCompany?.name || `Компания ${selectedCompanyId}`}</h2>
              <div className='text-sm text-gray-500'>Категорий: {totalCount}</div>
            </div>
          </div>

          <TableDefault<TransactionCategory> columns={columns} data={categories} className='bg-transparent' />

          <div className='mt-3'>
            <Pagination currentPage={currentPage} pageSize={pageSize} total={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>
      )}

      <ModalWindowDefault isOpen={isCreateOpen} onClose={closeCreate} showCloseIcon>
        <div>
          <h2 className='text-xl font-semibold mb-4'>Новая категория</h2>

          <TransactionCategoryForm
            fixedCompanyId={selectedCompanyId}
            companiesOverride={companies}
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
                {selectedCategory ? 'Редактирование категории' : 'Загрузка категории...'}
              </h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedCategory && (
                <TransactionCategoryForm
                  category={selectedCategory}
                  fixedCompanyId={selectedCompanyId}
                  companiesOverride={companies}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (selectedCompanyId) {
                      await fetchCategories(selectedCompanyId, currentPage, pageSize, globalSearch);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр категории</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedCategory && (
                <div className='space-y-2 text-sm text-gray-800'>
                  <div>
                    <strong>ID:</strong> {selectedCategory.id}
                  </div>
                  <div>
                    <strong>Название:</strong> {selectedCategory.name}
                  </div>
                  <div>
                    <strong>Компания:</strong>{' '}
                    {selectedCategory.company
                      ? typeof selectedCategory.company === 'string'
                        ? selectedCategory.company
                        : ((selectedCategory.company as Company).name ?? String((selectedCategory.company as Company).id))
                      : ''}
                  </div>
                  <div>
                    <strong>Создан:</strong> {selectedCategory.created_at ?? ''}
                  </div>
                  <div>
                    <strong>Обновлен:</strong> {selectedCategory.updated_at ?? ''}
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
