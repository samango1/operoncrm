'use client';

import React, { useEffect, useState } from 'react';
import { getCompanies, getCompanyById } from '@/lib/api';
import type { Company } from '@/types/api/companies';
import Pagination from '@/components/Layouts/Pagination';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import CompanyForm from '@/components/Forms/CompanyForm';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import { Pencil, Eye } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/i18n';
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const s = searchParams?.get('search') ?? '';
    const p = parseInt(searchParams?.get('page') ?? '', 10) || 1;
    const ps = parseInt(searchParams?.get('page_size') ?? '', 10) || 10;
    setSearch(s);
    setCurrentPage(p);
    setPageSize(ps);
  }, [searchParams?.toString()]);
  const fetchCompanies = async (page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanies({
        page,
        page_size: ps,
        search: q,
      });
      setCompanies(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getCompanies error:', err);
      setError(t('ui.failed_to_load_companies'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchCompanies();
  }, [currentPage, pageSize, search]);
  const openViewModal = async (companyId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedCompany(null);
    setIsEditing(false);
    try {
      const company = await getCompanyById(companyId, {
        deep: true,
      });
      setSelectedCompany(company);
    } catch (err) {
      console.error('getCompanyById error:', err);
      setModalError(t('ui.failed_to_load_company'));
    } finally {
      setModalLoading(false);
    }
  };
  const openEditModal = async (companyId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedCompany(null);
    setIsEditing(true);
    try {
      const company = await getCompanyById(companyId, {
        deep: true,
      });
      setSelectedCompany(company);
    } catch (err) {
      console.error('getCompanyById error:', err);
      setModalError(t('ui.failed_to_load_company'));
    } finally {
      setModalLoading(false);
    }
  };
  const openCreateModal = () => {
    setSelectedCompany(null);
    setIsEditing(true);
    setModalError(null);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCompany(null);
    setModalError(null);
    setIsEditing(false);
  };
  const columns: Column<Company>[] = [
    {
      key: 'name',
      label: t('ui.title'),
    },
    {
      key: 'slug',
      label: t('ui.slug'),
    },
    {
      key: 'plan',
      label: t('ui.tariff'),
    },
    {
      key: 'actions',
      label: t('ui.actions'),
      render: (row: Company) => (
        <div className='flex gap-2'>
          <ButtonDefault
            onClick={(e) => {
              e.stopPropagation();
              openViewModal(String(row.id));
            }}
            type='button'
          >
            <Eye />
          </ButtonDefault>

          <ButtonDefault
            onClick={(e) => {
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
  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(page);
      updateUrl({
        page,
        page_size: newPageSize,
        search,
      });
      return;
    }
    setCurrentPage(page);
    updateUrl({
      page,
      page_size: pageSize,
      search,
    });
  };
  const updateUrl = (opts: { page?: number; page_size?: number; search?: string }) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (opts.search && opts.search.length > 0) {
        params.set('search', opts.search);
      } else {
        params.delete('search');
      }
      if (opts.page && opts.page > 1) {
        params.set('page', String(opts.page));
      } else {
        params.delete('page');
      }
      if (opts.page_size) {
        params.set('page_size', String(opts.page_size));
      } else {
        params.delete('page_size');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : `${pathname}`);
    } catch (e) {
      console.warn('updateUrl failed', e);
    }
  };
  const handleSearch = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
    updateUrl({
      page: 1,
      page_size: pageSize,
      search: q,
    });
  };
  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('ui.companies')}</h1>
          <p className='text-sm text-gray-500'>
            {t('ui.total')} {count}
          </p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive'>
            {t('ui.add')}
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        <SearchInput initialValue={search} onSearch={handleSearch} placeholder={t('ui.search_by_title_slug_plan')} />
      </div>

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>{t('ui.loading')}</div>
        ) : (
          <TableDefault<Company> columns={columns} data={companies} className='bg-transparent' />
        )}
      </div>

      <Pagination currentPage={currentPage} pageSize={pageSize} total={count} onPageChange={handlePageChange} />

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>
                {selectedCompany ? t('ui.editing_a_company') : t('ui.new_company')}
              </h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && (
                <CompanyForm
                  company={selectedCompany}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    await fetchCompanies(currentPage, pageSize, search);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>{t('ui.view_company')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading &&
                selectedCompany &&
                (() => {
                  const companyFields = [
                    {
                      label: 'ID',
                      value: selectedCompany.id,
                    },
                    {
                      label: t('ui.title'),
                      value: selectedCompany.name,
                    },
                    {
                      label: 'Slug',
                      value: selectedCompany.slug,
                    },
                    {
                      label: t('ui.plan'),
                      value: selectedCompany.plan,
                    },
                    {
                      label: t('ui.members'),
                      value: selectedCompany.members?.length ?? 0,
                    },
                    {
                      label: t('ui.created_4'),
                      value: selectedCompany.created_at,
                    },
                    {
                      label: t('ui.updated_4'),
                      value: selectedCompany.updated_at,
                    },
                  ];
                  const createdByFields = [
                    {
                      label: 'ID',
                      value: selectedCompany.created_by?.id,
                    },
                    {
                      label: t('ui.full_name'),
                      value: selectedCompany.created_by?.name,
                    },
                    {
                      label: t('ui.phone_number'),
                      value: selectedCompany.created_by?.phone,
                    },
                    {
                      label: t('ui.role_of_the_platform'),
                      value: selectedCompany.created_by?.platform_role,
                    },
                  ];
                  return (
                    <div className='space-y-2 text-sm text-gray-800'>
                      {companyFields.map((field) => (
                        <div key={field.label}>
                          <strong>{field.label}:</strong> {String(field.value ?? '')}
                        </div>
                      ))}

                      <div className='bg-gray-200 rounded p-4'>
                        <div className='mb-2 font-medium'>{t('ui.created_by')}</div>
                        {createdByFields.map((field) => (
                          <div key={field.label}>
                            <strong>{field.label}:</strong> {String(field.value ?? '')}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
            </>
          )}
        </div>
      </ModalWindowDefault>
    </>
  );
}
