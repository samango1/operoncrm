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
import { t } from '@/i18n';
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
      const companiesRes = await getCompanies({
        page: 1,
        page_size: 1000,
      });
      setCompanies(companiesRes.results as Company[]);
    } catch (err) {
      console.error('fetchCompanies error:', err);
      setError(t('ui.failed_to_load_companies'));
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
      const res = await getCompanyTransactionCategories(companyId, {
        page,
        page_size: ps,
        search,
      });
      setCategories(res.results as TransactionCategory[]);
      setTotalCount(res.count);
    } catch (err) {
      console.error('fetchCategories error:', err);
      setError(t('ui.failed_to_load_categories'));
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
      setModalError(t('ui.failed_to_load_category'));
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
      setModalError(t('ui.failed_to_load_category'));
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
    {
      key: 'name',
      label: t('ui.title'),
    },
    {
      key: 'created_by',
      label: t('ui.created'),
      render: (r: TransactionCategory) => {
        if (!r.created_by) return '';
        if (typeof r.created_by === 'string') return r.created_by;
        return r.created_by.name ?? String(r.created_by.id ?? '');
      },
    },
    {
      key: 'actions',
      label: t('ui.actions'),
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
    closeCreate();
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
          <h1 className='text-2xl font-semibold'>{t('ui.transaction_categories')}</h1>
          <p className='text-sm text-gray-500'>
            {selectedCompanyId
              ? t('ui.total_categories_value_0', {
                  v0: totalCount,
                })
              : t('ui.select_a_company_to_view_categories')}
          </p>
        </div>

        <ButtonDefault
          type='button'
          variant='positive'
          onClick={() => {
            if (!selectedCompanyId) {
              alert(t('ui.first_select_a_company'));
              return;
            }
            openCreate();
          }}
        >
          {t('ui.add')}
        </ButtonDefault>
      </section>

      <div className='mb-4 space-y-4'>
        <div>
          <SelectOption
            label={t('ui.company')}
            placeholder={t('ui.select_a_company')}
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
          <SearchInput initialValue={globalSearch} onSearch={handleSearch} placeholder={t('ui.search_by_name')} />
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>{t('ui.select_a_company_to_view_categories')}</div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>{t('ui.loading')}</div>
      ) : categories.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch
            ? t('ui.there_are_no_categories_matching_your_request')
            : t('ui.there_are_no_categories_for_this_company')}
        </div>
      ) : (
        <section className='space-y-4'>
          <div className='flex justify-between items-center mb-3'>
            <div>
              <h2 className='text-lg font-medium'>
                {selectedCompany?.name ||
                  t('ui.company_value_0', {
                    v0: selectedCompanyId,
                  })}
              </h2>
              <div className='text-sm text-gray-500'>
                {t('ui.categories_3')} {totalCount}
              </div>
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
          <h2 className='text-xl font-semibold mb-4'>{t('ui.new_category')}</h2>

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
                {selectedCategory ? t('ui.editing_a_category') : t('ui.loading_category')}
              </h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

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
              <h2 className='text-xl font-semibold mb-4'>{t('ui.view_category')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedCategory && (
                <div className='space-y-2 text-sm text-gray-800'>
                  <div>
                    <strong>ID:</strong> {selectedCategory.id}
                  </div>
                  <div>
                    <strong>{t('ui.title_2')}</strong> {selectedCategory.name}
                  </div>
                  <div>
                    <strong>{t('ui.company_2')}</strong>{' '}
                    {selectedCategory.company
                      ? typeof selectedCategory.company === 'string'
                        ? selectedCategory.company
                        : ((selectedCategory.company as Company).name ?? String((selectedCategory.company as Company).id))
                      : ''}
                  </div>
                  <div>
                    <strong>{t('ui.created_by')}</strong> {selectedCategory.created_at ?? ''}
                  </div>
                  <div>
                    <strong>{t('ui.updated_2')}</strong> {selectedCategory.updated_at ?? ''}
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
