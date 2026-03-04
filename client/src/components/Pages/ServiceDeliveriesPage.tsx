'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Client } from '@/types/api/clients';
import type { Company } from '@/types/api/companies';
import type { ClientService } from '@/types/api/client-services';
import type { Service } from '@/types/api/services';
import { getCompanies, getCompanyBySlug, getCompanyClients, getClientServices } from '@/lib/api';
import { formatMoney } from '@/lib/decimal';
import TableDefault, { Column } from '@/components/Tables/TableDefault';
import Pagination from '@/components/Layouts/Pagination';
import SelectOption from '@/components/Inputs/SelectOption';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import { t } from '@/i18n';
const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const normalized = String(value);
  if (!normalized.includes('T')) return normalized.slice(0, 16);
  return normalized.replace('T', ' ').slice(0, 16);
};
const formatRemaining = (item: ClientService): string => {
  if (item.status === 'expired') return t('ui.expired');
  if (!item.ends_at) return '—';
  const end = new Date(item.ends_at).getTime();
  if (!Number.isFinite(end)) return '—';
  const now = Date.now();
  const diffMs = end - now;
  if (diffMs <= 0) return t('ui.expired');
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60)
    return t('ui.value_0_min', {
      v0: totalMinutes,
    });
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24)
    return remMinutes
      ? t('ui.value_0_h_value_1_min', {
          v0: totalHours,
          v1: remMinutes,
        })
      : t('ui.value_0_h', {
          v0: totalHours,
        });
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours
    ? t('ui.value_0_d_value_1_h', {
        v0: days,
        v1: remHours,
      })
    : t('ui.value_0_d', {
        v0: days,
      });
};
type ServiceDeliveriesPageProps = {
  tenantSlug?: string;
};
export default function ServiceDeliveriesPage({ tenantSlug }: ServiceDeliveriesPageProps) {
  const [assignments, setAssignments] = useState<ClientService[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const isTenantMode = Boolean(tenantSlug);
  const fetchCompanies = async () => {
    try {
      const res = await getCompanies({
        page: 1,
        page_size: 1000,
      });
      setCompanies(res.results as Company[]);
    } catch (err) {
      console.error('fetchCompanies error:', err);
      setError(t('ui.failed_to_load_companies'));
    }
  };
  const fetchClients = async (companyId?: string) => {
    if (!companyId) {
      setClients([]);
      return;
    }
    try {
      const res = await getCompanyClients(String(companyId), {
        page: 1,
        page_size: 1000,
      });
      setClients(res.results as Client[]);
    } catch (err) {
      console.error('fetchClients error:', err);
      setClients([]);
    }
  };
  const fetchAssignments = async (clientId: string, page = currentPage, ps = pageSize) => {
    if (!clientId) {
      setAssignments([]);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getClientServices(clientId, {
        page,
        page_size: ps,
      });
      setAssignments(res.results as ClientService[]);
      setTotalCount(res.count ?? 0);
    } catch (err) {
      console.error('fetchAssignments error:', err);
      setError(t('ui.failed_to_load_provided_services'));
    } finally {
      setLoading(false);
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
      try {
        const companyRes = await getCompanyBySlug(tenantSlug);
        setTenantCompany(companyRes as Company);
        setSelectedCompanyId(companyRes?.id ? String(companyRes.id) : undefined);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setError(t('ui.failed_to_load_company'));
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
      fetchClients(selectedCompanyId);
    } else if (!isTenantMode) {
      fetchClients();
    }
    setSelectedClientId(undefined);
    setAssignments([]);
    setTotalCount(0);
  }, [selectedCompanyId, isTenantMode]);
  useEffect(() => {
    if (selectedClientId) {
      fetchAssignments(selectedClientId, currentPage, pageSize);
    } else {
      setAssignments([]);
      setTotalCount(0);
    }
  }, [selectedClientId, currentPage, pageSize]);
  useEffect(() => {
    if (!selectedClientId) return;
    const exists = clients.some((c) => String(c.id) === String(selectedClientId));
    if (!exists) {
      setSelectedClientId(undefined);
    }
  }, [clients, selectedClientId]);
  const selectedCompany = useMemo(() => {
    if (isTenantMode) return tenantCompany ?? undefined;
    if (!selectedCompanyId) return undefined;
    return companies.find((c) => String(c.id) === String(selectedCompanyId));
  }, [isTenantMode, tenantCompany, selectedCompanyId, companies]);
  const selectedClient = useMemo(() => {
    if (!selectedClientId) return undefined;
    return clients.find((client) => String(client.id) === String(selectedClientId));
  }, [clients, selectedClientId]);
  const companyOptions: OptionType<string>[] = useMemo(() => {
    return companies.map((c) => ({
      value: String(c.id),
      label: c.name || c.slug || String(c.id),
    }));
  }, [companies]);
  const clientOptions: OptionType<string>[] = useMemo(() => {
    return (clients ?? []).map((c) => ({
      value: String(c.id),
      label: c.name ? `${c.name}${c.phone ? ` (${c.phone})` : ''}` : String(c.id),
    }));
  }, [clients]);
  const columns: Column<ClientService>[] = [
    {
      key: 'service',
      label: t('ui.service'),
      render: (row) => {
        if (!row.service) return '';
        if (typeof row.service === 'string') return row.service;
        const svc = row.service as Service;
        return svc.name ?? String(svc.id ?? '');
      },
    },
    {
      key: 'status',
      label: t('ui.status'),
      render: (row) => (row.status === 'expired' ? t('ui.expired') : t('ui.active_3')),
    },
    {
      key: 'starts_at',
      label: t('ui.start'),
      render: (row) => formatDateTime(row.starts_at),
    },
    {
      key: 'ends_at',
      label: t('ui.end'),
      render: (row) => formatDateTime(row.ends_at ?? ''),
    },
    {
      key: 'remaining',
      label: t('ui.remaining'),
      render: (row) => formatRemaining(row),
    },
    {
      key: 'price',
      label: t('ui.price'),
      render: (row) => {
        if (!row.service || typeof row.service === 'string') return '';
        const svc = row.service as Service;
        const formatted = formatMoney(svc.price);
        if (!formatted) return '';
        return [formatted, svc.currency].filter(Boolean).join(' ');
      },
    },
  ];
  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(page);
    } else {
      setCurrentPage(page);
    }
  };
  const headerSubtitle = selectedClientId
    ? t('ui.total_services_value_0', {
        v0: totalCount,
      })
    : selectedCompany
      ? t('ui.select_a_client_to_view_services')
      : isTenantMode
        ? companyLoading
          ? t('ui.loading')
          : t('ui.company_not_found')
        : t('ui.select_a_company_to_view_services');
  return (
    <>
      <section className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('ui.customer_services')}</h1>
          <p className='text-sm text-gray-500'>{headerSubtitle}</p>
        </div>
      </section>

      <div className='mb-4 space-y-4'>
        {!isTenantMode && (
          <div>
            <SelectOption
              label={t('ui.company')}
              placeholder={t('ui.select_a_company')}
              options={companyOptions}
              value={selectedCompanyId}
              onChange={(v) => {
                setSelectedCompanyId(v);
                setCurrentPage(1);
              }}
            />
          </div>
        )}

        {selectedCompanyId && (
          <div>
            <SelectOption
              label={t('ui.client')}
              placeholder={clients.length === 0 ? t('ui.no_clients_found') : t('ui.select_client')}
              options={clientOptions}
              value={selectedClientId}
              onChange={(v) => {
                setSelectedClientId(v as string | undefined);
                setCurrentPage(1);
              }}
              disabled={clients.length === 0}
            />
          </div>
        )}
      </div>

      {error && <div className='text-red-600 mb-4'>{error}</div>}

      {!selectedCompanyId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>
          {isTenantMode
            ? companyLoading
              ? t('ui.loading')
              : t('ui.company_not_found')
            : t('ui.select_a_company_to_view_services')}
        </div>
      ) : !selectedClientId ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>{t('ui.select_a_client_to_view_services')}</div>
      ) : loading ? (
        <div className='p-6 bg-white/5 rounded text-gray-500'>{t('ui.loading')}</div>
      ) : assignments.length === 0 ? (
        <div className='text-gray-600 p-6 bg-white/5 rounded'>{t('ui.the_client_has_no_services_provided')}</div>
      ) : (
        <section className='space-y-4'>
          {!isTenantMode && (
            <div className='flex justify-between items-center mb-3'>
              <div>
                <h2 className='text-lg font-medium'>
                  {selectedCompany?.name ||
                    t('ui.company_value_0', {
                      v0: selectedCompanyId,
                    })}
                </h2>
                <div className='text-sm text-gray-500'>
                  {t('ui.client_2')} {selectedClient?.name ?? selectedClient?.phone ?? selectedClientId} {t('ui.services')}{' '}
                  {totalCount}
                </div>
              </div>
            </div>
          )}

          <TableDefault<ClientService> columns={columns} data={assignments} className='bg-transparent' />

          <div className='mt-3'>
            <Pagination currentPage={currentPage} pageSize={pageSize} total={totalCount} onPageChange={handlePageChange} />
          </div>
        </section>
      )}
    </>
  );
}
