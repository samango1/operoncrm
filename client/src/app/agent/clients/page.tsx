'use client';

import React, { useEffect, useState } from 'react';
import { getClients, getClientById } from '@/lib/api';
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ClientsPage() {
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

  const fetchClients = async (page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getClients({ page, page_size: ps, search: q });
      setClients(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getClients error:', err);
      setError('Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [currentPage, pageSize, search]);

  const openViewModal = async (clientId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(false);

    try {
      const item = await getClientById(clientId, { deep: true });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
      setModalError('Не удалось загрузить клиента');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (clientId: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(true);

    try {
      const item = await getClientById(clientId, { deep: true });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
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
    { key: 'phone', label: 'Телефон', render: (row) => formatPhoneDisplay(String(row.phone ?? '')) },
    { key: 'type', label: 'Тип' },
    {
      key: 'company',
      label: 'Компания',
      render: (r: { company?: Company | string }) => {
        if (!r.company) return '';
        if (typeof r.company === 'string') {
          return r.company;
        }
        return r.company.name ?? String(r.company.id);
      },
    },
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
      setCurrentPage(page);
      updateUrl({ page, page_size: newPageSize, search });
      return;
    }
    setCurrentPage(page);
    updateUrl({ page, page_size: pageSize, search });
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
    updateUrl({ page: 1, page_size: pageSize, search: q });
  };

  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Клиенты</h1>
          <p className='text-sm text-gray-500'>Всего: {count}</p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive'>
            Добавить
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        <SearchInput initialValue={search} onSearch={handleSearch} placeholder='Поиск по имени, телефону, типу, описанию' />
      </div>

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {loading ? (
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
                  onCancel={closeModal}
                  onSuccess={async () => {
                    closeModal();
                    await fetchClients(currentPage, pageSize, search);
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
