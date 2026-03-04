'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getClients, getClientById, getCompanies, getCompanyBySlug, getCompanyClientById, getCompanyClients } from '@/lib/api';
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
import { t } from '@/i18n';
type ClientsPageProps = {
  tenantSlug?: string;
};
export default function ClientsPage({ tenantSlug }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
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
  const isTenantMode = Boolean(tenantSlug);
  useEffect(() => {
    const resolvedRole = getPlatformRoleFromCookie();
    setRole(resolvedRole);
  }, []);
  const isScopedByCompany = useMemo(() => isTenantMode || role === 'admin' || role === 'agent', [isTenantMode, role]);
  useEffect(() => {
    if (!isScopedByCompany || isTenantMode) return;
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
    fetchCompanies();
  }, [isScopedByCompany, isTenantMode]);
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
        setError(t('ui.failed_to_load_company'));
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
    if (isTenantMode) {
      setValidOnly(null);
      return;
    }
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
  }, [searchParams?.toString(), role, isTenantMode]);
  const showValidSwitch = useMemo(() => !isTenantMode && (role === 'admin' || role === 'agent'), [isTenantMode, role]);
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
        ? await getCompanyClients(String(selectedCompanyId), {
            page,
            page_size: ps,
            search: q,
            valid: valid ?? undefined,
          })
        : await getClients({
            page,
            page_size: ps,
            search: q,
            valid: valid ?? undefined,
          });
      setClients(res.results);
      setCount(res.count);
    } catch (err) {
      console.error('getClients error:', err);
      setError(t('ui.failed_to_load_clients'));
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
        : await getClientById(clientId, {
            deep: true,
          });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
      setModalError(t('ui.failed_to_load_client'));
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
        : await getClientById(clientId, {
            deep: true,
          });
      setSelectedClient(item);
    } catch (err) {
      console.error('getClientById error:', err);
      setModalError(t('ui.failed_to_load_client'));
    } finally {
      setModalLoading(false);
    }
  };
  const openCreateModal = () => {
    if (isScopedByCompany && !selectedCompanyId) {
      alert(isTenantMode ? t('ui.company_not_found') : t('ui.first_select_a_company'));
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
    {
      key: 'name',
      label: t('ui.name_title'),
    },
    {
      key: 'phone',
      label: t('ui.phone'),
      render: (row) => formatPhoneDisplay(String(row.phone ?? '')),
    },
    {
      key: 'type',
      label: t('ui.type'),
    },
    {
      key: 'company',
      label: t('ui.company'),
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
      label: t('ui.actions'),
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
  const updateUrl = (opts: { page?: number; page_size?: number; search?: string; valid?: boolean | null }) => {
    if (isTenantMode) return;
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
    updateUrl({
      page: 1,
      page_size: pageSize,
      search: q,
      valid: validOnly,
    });
  };
  const companyOptions = useMemo(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name || c.slug || String(c.id),
    }));
  }, [companies]);
  const noCompanySelected = isScopedByCompany && !selectedCompanyId;
  const headerSubtitle = isTenantMode
    ? companyLoading
      ? t('ui.loading_company')
      : selectedCompanyId
        ? t('ui.total_value_0', {
            v0: count,
          })
        : t('ui.company_not_found')
    : isScopedByCompany
      ? selectedCompanyId
        ? t('ui.total_clients_value_0', {
            v0: count,
          })
        : t('ui.select_a_company_to_view_clients')
      : t('ui.total_value_0', {
          v0: count,
        });
  const disableCreate = isTenantMode && noCompanySelected;
  const companiesOverride = isTenantMode ? (tenantCompany ? [tenantCompany] : []) : isScopedByCompany ? companies : undefined;
  return (
    <>
      <section className='mb-6 flex justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('ui.clients')}</h1>
          <p className='text-sm text-gray-500'>{headerSubtitle}</p>
        </div>
        <div className='content-center'>
          <ButtonDefault onClick={openCreateModal} variant='positive' disabled={disableCreate}>
            {t('ui.add')}
          </ButtonDefault>
        </div>
      </section>

      <div className='mb-4 space-y-4'>
        {!isTenantMode && isScopedByCompany && (
          <SelectOption
            label={t('ui.company')}
            placeholder={t('ui.select_a_company')}
            options={companyOptions}
            value={selectedCompanyId}
            onChange={(value) => {
              setSelectedCompanyId(value);
              setCurrentPage(1);
              setSearch('');
              updateUrl({
                page: 1,
                page_size: pageSize,
                search: '',
                valid: validOnly,
              });
            }}
          />
        )}

        {!noCompanySelected && (
          <div className='flex items-center justify-between gap-4'>
            <SearchInput
              initialValue={search}
              onSearch={handleSearch}
              placeholder={t('ui.search_by_name_phone_type_description')}
            />
            {!isTenantMode && (
              <ButtonDefault
                type='button'
                onClick={() => setShowFilters((v) => !v)}
                aria-label={t('ui.show_filters')}
                variant={showFilters ? 'positive' : 'outline'}
              >
                <Funnel />
              </ButtonDefault>
            )}
          </div>
        )}
      </div>

      {!isTenantMode && !noCompanySelected && showFilters && (
        <div className='mb-4 rounded-lg border border-gray-200 bg-white/60 p-3'>
          {showValidSwitch && validOnly !== null && (
            <ToggleSwitch
              checked={validOnly}
              onChange={(next) => {
                setValidOnly(next);
                setCurrentPage(1);
                updateUrl({
                  page: 1,
                  page_size: pageSize,
                  search,
                  valid: next,
                });
              }}
              label={t('ui.show')}
              onLabel={t('ui.valid')}
              offLabel={t('ui.invalid')}
            />
          )}
        </div>
      )}

      {error && <p className='text-red-600 mb-4'>{error}</p>}

      <div className='mb-4'>
        {noCompanySelected ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>
            {isTenantMode ? t('ui.company_not_found') : t('ui.select_a_company_to_view_clients')}
          </div>
        ) : loading ? (
          <div className='p-6 bg-white/5 rounded text-gray-500'>{t('ui.loading')}</div>
        ) : clients.length === 0 ? (
          <div className='text-gray-600 p-6 bg-white/5 rounded'>
            {search
              ? t('ui.there_are_no_clients_matching_your_request')
              : isScopedByCompany
                ? t('ui.there_are_no_clients_for_this_company')
                : t('ui.no_clients')}
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
              <h2 className='text-xl font-semibold mb-4'>{selectedClient ? t('ui.editing_a_client') : t('ui.new_client')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading && (
                <ClientForm
                  client={selectedClient}
                  fixedCompanyId={isScopedByCompany ? selectedCompanyId : undefined}
                  companiesOverride={companiesOverride}
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
              <h2 className='text-xl font-semibold mb-4'>{t('ui.view_client')}</h2>

              {modalLoading && <div className='text-sm text-gray-500'>{t('ui.loading')}</div>}

              {modalError && <div className='text-sm text-red-600'>{modalError}</div>}

              {!modalLoading &&
                selectedClient &&
                (() => {
                  const fields = [
                    {
                      label: 'ID',
                      value: selectedClient.id,
                    },
                    {
                      label: t('ui.name'),
                      value: selectedClient.name,
                    },
                    {
                      label: t('ui.phone'),
                      value: selectedClient.phone,
                    },
                    {
                      label: t('ui.type'),
                      value: selectedClient.type,
                    },
                    {
                      label: t('ui.company'),
                      value: selectedClient.company
                        ? typeof selectedClient.company === 'string'
                          ? selectedClient.company
                          : (selectedClient.company as Company).name
                        : '',
                    },
                    {
                      label: t('ui.description'),
                      value: selectedClient.description ?? '',
                    },
                    {
                      label: t('ui.created_2'),
                      value: selectedClient.created_at ?? '',
                    },
                    {
                      label: t('ui.updated'),
                      value: selectedClient.updated_at ?? '',
                    },
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
