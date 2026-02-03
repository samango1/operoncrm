'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Service } from '@/types/api/services';
import type { Company } from '@/types/api/companies';
import { getCompanies, getCompanyBySlug, getCompanyServices, getCompanyServiceById } from '@/lib/api';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import ServiceForm from '@/components/Forms/ServiceForm';
import { formatMoney } from '@/lib/decimal';

import { Pencil, Eye } from 'lucide-react';

type ServicesPageProps = {
  tenantSlug?: string;
};

const formatDuration = (minutes?: number | null): string => {
  if (minutes === null || minutes === undefined) return '';
  if (minutes === -1) return 'Одноразовая';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (minutes < 60 * 24) {
    return mins ? `${hours} ч ${mins} мин` : `${hours} ч`;
  }
  const days = Math.floor(minutes / (60 * 24));
  const remainHours = Math.floor((minutes % (60 * 24)) / 60);
  if (remainHours > 0) return `${days} д ${remainHours} ч`;
  return `${days} д`;
};

export default function ServicesPage({ tenantSlug }: ServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
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
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  const fetchServices = async (companyId: string, page = currentPage, ps = pageSize, search = globalSearch) => {
    if (!companyId) {
      setServices([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyServices(companyId, { page, page_size: ps, search });
      setServices(res.results as Service[]);
      setTotalCount(res.count);
    } catch (err) {
      console.error('fetchServices error:', err);
      setError('Не удалось загрузить услуги');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isTenantMode) return;
    fetchCompanies();
  }, [isTenantMode]);

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchTenantCompany = async () => {
      setCompanyLoading(true);
      setError(null);
      setTenantCompany(null);
      setSelectedCompanyId(undefined);
      try {
        const companyRes = await getCompanyBySlug(tenantSlug);
        setTenantCompany(companyRes as Company);
        setSelectedCompanyId(companyRes?.id ? String(companyRes.id) : undefined);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setError('Не удалось загрузить компанию');
        setTenantCompany(null);
        setSelectedCompanyId(undefined);
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchTenantCompany();
  }, [tenantSlug]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchServices(selectedCompanyId, currentPage, pageSize, globalSearch);
    } else {
      setServices([]);
      setTotalCount(0);
    }
  }, [selectedCompanyId, currentPage, pageSize, globalSearch]);

  const selectedCompany = useMemo(() => {
    if (isTenantMode) return tenantCompany ?? undefined;
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [isTenantMode, tenantCompany, selectedCompanyId, companies]);

  const openViewModal = async (serviceId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(false);
    setSelectedService(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyServiceById(selectedCompanyId, serviceId);
      setSelectedService(item as Service);
    } catch (err) {
      console.error('getCompanyServiceById error:', err);
      setModalError('Не удалось загрузить услугу');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (serviceId: string) => {
    if (!selectedCompanyId) return;
    setIsModalOpen(true);
    setIsEditing(true);
    setSelectedService(null);
    setModalLoading(true);
    setModalError(null);
    try {
      const item = await getCompanyServiceById(selectedCompanyId, serviceId);
      setSelectedService(item as Service);
    } catch (err) {
      console.error('getCompanyServiceById error:', err);
      setModalError('Не удалось загрузить услугу');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
    setModalError(null);
    setIsEditing(false);
  };

  const columns: Column<Service>[] = [
    { key: 'name', label: 'Название' },
    {
      key: 'price_currency',
      label: 'Цена',
      render: (r) => {
        const formatted = formatMoney(r.price);
        return [formatted, r.currency].filter(Boolean).join(' ');
      },
    },
    {
      key: 'duration',
      label: 'Длительность',
      render: (r) => formatDuration(r.duration_minutes),
    },
    {
      key: 'active',
      label: 'Активна',
      render: (r) => (r.active ? 'Да' : 'Нет'),
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (row: Service) => (
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
    if (selectedCompanyId) await fetchServices(selectedCompanyId, currentPage, pageSize, globalSearch);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(page);
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
      ? 'Загрузка...'
      : tenantCompany
        ? `Всего услуг: ${totalCount}`
        : 'Не удалось определить компанию'
    : selectedCompanyId
      ? `Всего услуг: ${totalCount}`
      : 'Выберите компанию для просмотра услуг';

  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>Услуги</h1>
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
              onChange={(v) => {
                setSelectedCompanyId(v);
                setCurrentPage(1);
                setGlobalSearch('');
              }}
            />
          </div>
        )}

        {(isTenantMode || selectedCompanyId) && (
          <div className='flex items-center justify-between gap-4'>
            <SearchInput initialValue={globalSearch} onSearch={handleSearch} placeholder='Поиск по названию и описанию' />
          </div>
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {isTenantMode ? 'Компания не найдена' : 'Выберите компанию для просмотра услуг'}
        </div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
      ) : services.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {globalSearch ? 'Нет услуг, соответствующих запросу.' : 'Нет услуг для этой компании.'}
        </div>
      ) : (
        <section className='space-y-4'>
          {!isTenantMode && (
            <div className='flex justify-between items-center mb-3'>
              <div>
                <h2 className='text-lg font-medium'>{selectedCompany?.name || `Компания ${selectedCompanyId}`}</h2>
                <div className='text-sm text-gray-500'>Услуг: {totalCount}</div>
              </div>
            </div>
          )}

          <TableDefault<Service> columns={columns} data={services} className='bg-transparent' />

          <div className='mt-3'>
            <Pagination currentPage={currentPage} pageSize={pageSize} total={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>
      )}

      <ModalWindowDefault isOpen={isCreateOpen} onClose={closeCreate} showCloseIcon>
        <div>
          <h2 className='text-xl font-semibold mb-4'>Новая услуга</h2>
          <ServiceForm fixedCompanyId={selectedCompanyId} onCancel={closeCreate} onSuccess={onCreated} />
        </div>
      </ModalWindowDefault>

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>{selectedService ? 'Редактирование услуги' : 'Загрузка услуги...'}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedService && (
                <ServiceForm
                  service={selectedService}
                  fixedCompanyId={selectedCompanyId}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (!selectedCompanyId) return;
                    await fetchServices(selectedCompanyId, currentPage, pageSize, globalSearch);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр услуги</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && selectedService && (
                <div className='space-y-2 text-sm text-gray-800'>
                  <div>
                    <strong>ID:</strong> {selectedService.id}
                  </div>
                  <div>
                    <strong>Название:</strong> {selectedService.name}
                  </div>
                  <div>
                    <strong>Описание:</strong> {selectedService.description}
                  </div>
                  <div>
                    <strong>Цена:</strong> {formatMoney(selectedService.price)} {selectedService.currency}
                  </div>
                  <div>
                    <strong>Длительность:</strong> {formatDuration(selectedService.duration_minutes)}
                  </div>
                  <div>
                    <strong>Себестоимость:</strong> {formatMoney(selectedService.cost_price ?? '')}
                  </div>
                  <div>
                    <strong>Активна:</strong> {selectedService.active ? 'Да' : 'Нет'}
                  </div>
                  <div>
                    <strong>Компания:</strong>{' '}
                    {selectedService.company
                      ? typeof selectedService.company === 'string'
                        ? selectedService.company
                        : ((selectedService.company as Company).name ?? String((selectedService.company as Company).id))
                      : ''}
                  </div>
                  <div>
                    <strong>Создана:</strong> {selectedService.created_at ?? ''}
                  </div>
                  <div>
                    <strong>Обновлена:</strong> {selectedService.updated_at ?? ''}
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
