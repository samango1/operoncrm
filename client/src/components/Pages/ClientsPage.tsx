'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getClients, getClientById, getCompanies, getCompanyClientById, getCompanyClients } from '@/lib/api';
import { formatPhoneDisplay } from '@/lib/phone';
import { getPlatformRoleFromCookie } from '@/lib/role';
import type { Client } from '@/types/api/clients';
import type { Company } from '@/types/api/companies';
import type { PlatformRole } from '@/types/api/users';

import Pagination from '@/components/Layouts/Pagination';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import ClientForm from '@/components/Forms/ClientForm';
import ModalWindowDefault from '@/components/ModalWindows/ModalWindowDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SearchInput from '@/components/Inputs/SearchInput';
import SelectOption from '@/components/Inputs/SelectOption';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';

import { Pencil, Eye, Funnel } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [validOnly, setValidOnly] = useState<boolean | null>(null);
  const [role, setRole] = useState<PlatformRole | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const resolvedRole = getPlatformRoleFromCookie();
    setRole(resolvedRole);
  }, []);

  const isScopedByCompany = useMemo(() => role === 'admin' || role === 'agent', [role]);

  useEffect(() => {
    if (!isScopedByCompany) return;
    const fetchCompanies = async () => {
      try {
        const companiesRes = await getCompanies({ page: 1, page_size: 1000 });
        setCompanies(companiesRes.results as Company[]);
      } catch (err) {
        console.error('fetchCompanies error:', err);
        setError('Не удалось загрузить компании');
      }
    };
    fetchCompanies();
  }, [isScopedByCompany]);

  useEffect(() => {
    const s = searchParams?.get('search') ?? '';
    const p = parseInt(searchParams?.get('page') ?? '', 10) || 1;
    const ps = parseInt(searchParams?.get('page_size') ?? '', 10) || 10;
    const vRaw = searchParams?.get('valid');
    const vParsed = vRaw === 'true' ? true : vRaw === 'false' ? false : null;

    setSearch(s);
    setCurrentPage(p);
    setPageSize(ps);
    if (role === 'member') {
      setValidOnly(null);
    } else {
      setValidOnly(vParsed ?? true);
    }
  }, [searchParams?.toString(), role]);

  const showValidSwitch = useMemo(() => role === 'admin' || role === 'agent', [role]);

  const fetchClients = async (page = currentPage, ps = pageSize, q = search, valid = validOnly) => {
    setError(null);
    if (isScopedByCompany && !selectedCompanyId) {
      setClients([]);
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = isScopedByCompany
        ? await getCompanyClients(String(selectedCompanyId), { page, page_size: ps, search: q, valid: valid ?? undefined })
        : await getClients({ page, page_size: ps, search: q, valid: valid ?? undefined });
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
  }, [currentPage, pageSize, search, validOnly, selectedCompanyId, isScopedByCompany]);

  const openViewModal = async (clientId: string) => {
    if (isScopedByCompany && !selectedCompanyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(false);

    try {
      const item = isScopedByCompany
        ? await getCompanyClientById(String(selectedCompanyId), clientId)
        : await getClientById(clientId, { deep: true });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
      setModalError('Не удалось загрузить клиента');
    } finally {
      setModalLoading(false);
    }
  };

  const openEditModal = async (clientId: string) => {
    if (isScopedByCompany && !selectedCompanyId) return;
    setIsModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setSelectedClient(null);
    setIsEditing(true);

    try {
      const item = isScopedByCompany
        ? await getCompanyClientById(String(selectedCompanyId), clientId)
        : await getClientById(clientId, { deep: true });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
      setModalError('Не удалось загрузить клиента');
    } finally {
      setModalLoading(false);
    }
  };

  const openCreateModal = () => {
    if (isScopedByCompany && !selectedCompanyId) {
      alert('Сначала выберите компанию');
      return;
    }
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

  const updateUrl = (opts: { page?: number; page_size?: number; search?: string; valid?: boolean | null }) => {
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

      if (opts.valid === true) {
        params.set('valid', 'true');
      } else if (opts.valid === false) {
        params.set('valid', 'false');
      } else {
        params.delete('valid');
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
    updateUrl({ page: 1, page_size: pageSize, search: q, valid: validOnly });
  };

  const companyOptions = useMemo(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name || c.slug || String(c.id),
    }));
  }, [companies]);

  const noCompanySelected = isScopedByCompany && !selectedCompanyId;

  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Клиенты</h1>
          <p className='text-sm text-gray-500'>
            {isScopedByCompany
              ? selectedCompanyId
                ? `Всего клиентов: ${count}`
                : 'Выберите компанию для просмотра клиентов'
              : `Всего: ${count}`}
          </p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive'>
            Добавить
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 space-y-4'>
        {isScopedByCompany && (
          <SelectOption
            label='Компания'
            placeholder='Выберите компанию'
            options={companyOptions}
            value={selectedCompanyId}
            onChange={(value) => {
              setSelectedCompanyId(value);
              setCurrentPage(1);
              setSearch('');
              updateUrl({ page: 1, page_size: pageSize, search: '', valid: validOnly });
            }}
          />
        )}

        {!noCompanySelected && (
          <div className='flex items-center justify-between gap-4'>
            <SearchInput initialValue={search} onSearch={handleSearch} placeholder='Поиск по имени, телефону, типу, описанию' />
            <ButtonDefault
              type='button'
              onClick={() => setShowFilters((v) => !v)}
              aria-label='Показать фильтры'
              variant={showFilters ? 'positive' : 'outline'}
            >
              <Funnel />
            </ButtonDefault>
          </div>
        )}
      </div>

      {!noCompanySelected && showFilters && (
        <div className='mb-4 rounded-lg border border-gray-200 bg-white/60 p-3'>
          {showValidSwitch && validOnly !== null && (
            <ToggleSwitch
              checked={validOnly}
              onChange={(next) => {
                setValidOnly(next);
                setCurrentPage(1);
                updateUrl({ page: 1, page_size: pageSize, search, valid: next });
              }}
              label='Показывать'
              onLabel='Валидные'
              offLabel='Невалидные'
            />
          )}
        </div>
      )}

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {noCompanySelected ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>Выберите компанию для просмотра клиентов</div>
        ) : loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>Загрузка...</div>
        ) : clients.length === 0 ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>
            {search
              ? 'Нет клиентов, соответствующих запросу.'
              : isScopedByCompany
                ? 'Нет клиентов для этой компании.'
                : 'Нет клиентов.'}
          </div>
        ) : (
          <TableDefault<Client>
            columns={columns}
            data={clients}
            className='bg-transparent'
            rowClassName={validOnly === false ? 'bg-red-100 hover:bg-red-200' : undefined}
          />
        )}
      </div>

      {!noCompanySelected && (
        <Pagination currentPage={currentPage} pageSize={pageSize} total={count} onPageChange={handlePageChange} />
      )}

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
                  fixedCompanyId={isScopedByCompany ? selectedCompanyId : undefined}
                  companiesOverride={isScopedByCompany ? companies : undefined}
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
