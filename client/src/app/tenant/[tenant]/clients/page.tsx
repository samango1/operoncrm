'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCompanyBySlug, getCompanyClients, getCompanyClientById } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import type { Client } from '@/types/api/clients';
import type { Company } from '@/types/api/companies';

import Pagination from '@/components/Layouts/Pagination';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import ClientForm from '@/components/Forms/ClientForm';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';

import { Pencil, Eye } from 'lucide-react';

export default function TenantClientsPage() {
  const params = useParams<{ tenant: string }>();
  const [slug, setSlug] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const fetchClients = async (id: string, page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyClients(id, { page, page_size: ps, search: q });
      setClients(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getCompanyClients error:', err);
      setError('Не удалось загрузить клиентов');
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
      setCount(0);
      return;
    }
    fetchClients(companyId);
  }, [companyId, currentPage, pageSize, search]);

  const openViewModal = async (clientId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(false);

    try {
      const item = await getCompanyClientById(companyId, clientId);
      setSelectedClient(item);
    } catch (err) {
      console.error('getCompanyClientById error:', err);
      setModalError('Не удалось загрузить клиента');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (clientId: string) => {
    if (!companyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(true);

    try {
      const item = await getCompanyClientById(companyId, clientId);
      setSelectedClient(item);
    } catch (err) {
      console.error('getCompanyClientById error:', err);
      setModalError('Не удалось загрузить клиента');
    } finally {
      setModalLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedClient(null);
    setIsEditing(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedClient(null);
    setModalError(null);
    setIsEditing(false);
  };

  const columns: Column<Client>[] = [
    { key: 'name', label: 'Имя / Название' },
    { key: 'type', label: 'Тип' },
    { key: 'phone', label: 'Телефон', render: (row) => formatPhoneDisplay(String(row.phone ?? '')) },
    {
      key: 'actions',
      label: 'Действия',
      render: (row: Client) => (
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
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
  };

  const companyOptions = useMemo(() => (company ? [company] : []), [company]);

  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Клиенты</h1>
          <p className='text-sm text-gray-500'>
            {companyId ? `Всего: ${count}` : companyLoading ? 'Загрузка компании...' : 'Компания не найдена'}
          </p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive' disabled={!companyId}>
            Добавить
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        {companyId && <SearchInput initialValue={search} onSearch={handleSearch} placeholder='Поиск клиентов...' />}
      </div>

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {!companyId ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>Компания не найдена</div>
        ) : loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
        ) : (
          <TableDefault<Client> columns={columns} data={clients} className='bg-transparent' />
        )}
      </div>

      <Pagination currentPage={currentPage} pageSize={pageSize} total={count} onPageChange={handlePageChange} />

      <ModalWindowDefault isOpen={isModalOpen} onClose={closeModal} showCloseIcon>
        <div>
          {isEditing ? (
            <>
              <h2 className='text-xl font-semibold mb-4'>{selectedClient ? 'Редактирование клиента' : 'Новый клиент'}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && (
                <ClientForm
                  client={selectedClient}
                  fixedCompanyId={companyId}
                  companiesOverride={companyOptions}
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    if (companyId) {
                      await fetchClients(companyId, currentPage, pageSize, search);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className='text-xl font-semibold mb-4'>Просмотр клиента</h2>

              {modalLoading && <div className='text-sm text-gray-500'>Загрузка...</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading &&
                selectedClient &&
                (() => {
                  const fields = [
                    { label: 'ID', value: selectedClient.id },
                    { label: 'Имя', value: selectedClient.name },
                    { label: 'Телефон', value: selectedClient.phone },
                    { label: 'Тип', value: selectedClient.type },
                    {
                      label: 'Компания',
                      value: selectedClient.company
                        ? typeof selectedClient.company === 'string'
                          ? selectedClient.company
                          : (selectedClient.company as Company).name
                        : '',
                    },
                    { label: 'Описание', value: selectedClient.description ?? '' },
                    { label: 'Создан', value: selectedClient.created_at ?? '' },
                    { label: 'Обновлен', value: selectedClient.updated_at ?? '' },
                  ];

                  return (
                    <div className='space-y-2 text-sm text-gray-800'>
                      {fields.map((f) => (
                        <div key={f.label}>
                          <strong>{f.label}:</strong> {String(f.value ?? '')}
                        </div>
                      ))}
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
