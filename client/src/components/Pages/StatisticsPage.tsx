'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Company } from '@/types/api/companies';
import type { Client } from '@/types/api/clients';
import type { Product } from '@/types/api/products';
import type { Service } from '@/types/api/services';
import type { PlatformRole } from '@/types/api/users';
import type { TransactionCategory } from '@/types/api/transactions';
import type {
  CompanyStatistics,
  CompanyStatisticsQuery,
  StatisticsGroupBy,
  StatisticsKeyAmountItem,
  StatisticsNamedAmountItem,
  StatisticsNamedUnitsItem,
} from '@/types/api/statistics';
import {
  getCompanies,
  getCompanyBySlug,
  getCompanyClients,
  getCompanyProducts,
  getCompanyServices,
  getCompanyStatistics,
  getCompanyTransactionCategories,
} from '@/lib/api';
import { formatMoney } from '@/lib/decimal';
import { getPlatformRoleFromCookie } from '@/lib/role';

import TableDefault, { Column } from '@/components/Tables/TableDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import SelectMultiple from '@/components/Inputs/SelectMultiple';
import InputDefault from '@/components/Inputs/InputDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import LineChart from '@/components/Charts/LineChart';
import PieChart from '@/components/Charts/PieChart';
import BarGraph from '@/components/Charts/BarGraph';

import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import { Funnel } from 'lucide-react';

type StatisticsPageProps = {
  tenantSlug?: string;
};

type FiltersState = {
  dateFrom: string;
  dateTo: string;
  groupBy: StatisticsGroupBy;
  type: 'all' | 'income' | 'outcome';
  method: 'all' | 'cash' | 'card';
  currency: 'all' | 'UZS' | 'USD';
  categoryIds: string[];
  productIds: string[];
  serviceIds: string[];
  clientIds: string[];
  validOnly: boolean | null;
  top: number;
};

function SummaryCard({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: 'default' | 'positive' | 'negative';
}) {
  const accentClass = accent === 'positive' ? 'text-green-600' : accent === 'negative' ? 'text-red-600' : 'text-gray-900';

  return (
    <div className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
      <p className='text-sm text-gray-500'>{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className='rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500'>{text}</div>;
}

function ChartCard({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
      <h3 className='text-base font-semibold mb-1'>{title}</h3>
      {hint ? <p className='text-xs text-gray-500 mb-3'>{hint}</p> : null}
      {children}
    </div>
  );
}

const toNumber = (value?: string | number | null): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const trimLabel = (value: string, maxLength = 28): string => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

const detectDominantCurrency = (items: StatisticsKeyAmountItem[]): FiltersState['currency'] => {
  if (!items || items.length === 0) return 'all';

  const normalized = items
    .map((item) => {
      const keyRaw = String(item.key ?? item.label ?? '')
        .trim()
        .toUpperCase();
      if (keyRaw !== 'UZS' && keyRaw !== 'USD') return null;
      return {
        key: keyRaw as Exclude<FiltersState['currency'], 'all'>,
        count: Number(item.count ?? 0),
        amountAbs: Math.abs(toNumber(item.amount)),
      };
    })
    .filter((item): item is { key: Exclude<FiltersState['currency'], 'all'>; count: number; amountAbs: number } =>
      Boolean(item)
    );

  if (normalized.length === 0) return 'all';

  normalized.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.amountAbs - a.amountAbs;
  });

  return normalized[0].key;
};

export default function StatisticsPage({ tenantSlug }: StatisticsPageProps) {
  const [statistics, setStatistics] = useState<CompanyStatistics | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantCompany, setTenantCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<PlatformRole | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currencyManuallyChanged, setCurrencyManuallyChanged] = useState(false);

  const isTenantMode = Boolean(tenantSlug);

  const [filters, setFilters] = useState<FiltersState>({
    dateFrom: '',
    dateTo: '',
    groupBy: 'day',
    type: 'all',
    method: 'all',
    currency: 'all',
    categoryIds: [],
    productIds: [],
    serviceIds: [],
    clientIds: [],
    validOnly: null,
    top: 8,
  });

  const loadCompanies = async () => {
    try {
      const companiesRes = await getCompanies({ page: 1, page_size: 1000 });
      setCompanies(companiesRes.results as Company[]);
    } catch (err) {
      console.error('loadCompanies error:', err);
      setError('Не удалось загрузить список компаний');
    }
  };

  const loadCompanyEntities = async (companyId: string) => {
    try {
      const [categoriesRes, clientsRes, productsRes, servicesRes] = await Promise.all([
        getCompanyTransactionCategories(companyId, { page: 1, page_size: 1000 }),
        getCompanyClients(companyId, { page: 1, page_size: 1000 }),
        getCompanyProducts(companyId, { page: 1, page_size: 1000 }),
        getCompanyServices(companyId, { page: 1, page_size: 1000 }),
      ]);

      const nextCategories = (categoriesRes.results as TransactionCategory[]) ?? [];
      const nextClients = (clientsRes.results as Client[]) ?? [];
      const nextProducts = (productsRes.results as Product[]) ?? [];
      const nextServices = (servicesRes.results as Service[]) ?? [];

      setCategories(nextCategories);
      setClients(nextClients);
      setProducts(nextProducts);
      setServices(nextServices);

      const categoryIdsSet = new Set(nextCategories.map((item) => String(item.id)));
      const clientIdsSet = new Set(nextClients.map((item) => String(item.id)));
      const productIdsSet = new Set(nextProducts.map((item) => String(item.id)));
      const serviceIdsSet = new Set(nextServices.map((item) => String(item.id)));

      setFilters((prev) => ({
        ...prev,
        categoryIds: prev.categoryIds.filter((id) => categoryIdsSet.has(String(id))),
        clientIds: prev.clientIds.filter((id) => clientIdsSet.has(String(id))),
        productIds: prev.productIds.filter((id) => productIdsSet.has(String(id))),
        serviceIds: prev.serviceIds.filter((id) => serviceIdsSet.has(String(id))),
      }));
    } catch (err) {
      console.error('loadCompanyEntities error:', err);
      setCategories([]);
      setClients([]);
      setProducts([]);
      setServices([]);
    }
  };

  useEffect(() => {
    const resolvedRole = getPlatformRoleFromCookie();
    setRole(resolvedRole);
  }, []);

  useEffect(() => {
    if (isTenantMode) return;
    loadCompanies();
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
    if (isTenantMode) {
      setFilters((prev) => (prev.validOnly !== null ? { ...prev, validOnly: null } : prev));
      return;
    }

    if (role === 'admin' || role === 'agent') {
      setFilters((prev) => (prev.validOnly === null ? { ...prev, validOnly: true } : prev));
      return;
    }

    setFilters((prev) => (prev.validOnly !== null ? { ...prev, validOnly: null } : prev));
  }, [role, isTenantMode]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setStatistics(null);
      setCategories([]);
      setClients([]);
      setProducts([]);
      setServices([]);
      return;
    }
    loadCompanyEntities(selectedCompanyId);
  }, [selectedCompanyId]);

  const statisticsQuery = useMemo<CompanyStatisticsQuery>(() => {
    return {
      date_from: filters.dateFrom || undefined,
      date_to: filters.dateTo || undefined,
      group_by: filters.groupBy,
      types: filters.type === 'all' ? undefined : [filters.type],
      methods: filters.method === 'all' ? undefined : [filters.method],
      currencies: filters.currency === 'all' ? undefined : [filters.currency],
      category_ids: filters.categoryIds.length > 0 ? filters.categoryIds : undefined,
      product_ids: filters.productIds.length > 0 ? filters.productIds : undefined,
      service_ids: filters.serviceIds.length > 0 ? filters.serviceIds : undefined,
      client_ids: filters.clientIds.length > 0 ? filters.clientIds : undefined,
      valid: filters.validOnly ?? undefined,
      top: filters.top,
    };
  }, [filters]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setStatistics(null);
      setError('Дата "С" не может быть позже даты "По".');
      return;
    }

    let cancelled = false;
    const fetchStatistics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getCompanyStatistics(selectedCompanyId, statisticsQuery);
        if (cancelled) return;
        const typedResponse = response as CompanyStatistics;
        setStatistics(typedResponse);

        if (!currencyManuallyChanged && filters.currency === 'all') {
          const dominantCurrency = detectDominantCurrency(typedResponse?.breakdowns?.currencies ?? []);
          if (dominantCurrency !== 'all') {
            setFilters((prev) => {
              if (prev.currency === dominantCurrency) return prev;
              return {
                ...prev,
                currency: dominantCurrency,
              };
            });
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('getCompanyStatistics error:', err);
        setStatistics(null);
        setError('Не удалось загрузить статистику');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatistics();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, statisticsQuery, filters.dateFrom, filters.dateTo, filters.currency, currencyManuallyChanged]);

  const selectedCompany = useMemo(() => {
    if (isTenantMode) return tenantCompany ?? undefined;
    if (!selectedCompanyId) return undefined;
    return companies.find((item) => String(item.id) === String(selectedCompanyId));
  }, [isTenantMode, tenantCompany, selectedCompanyId, companies]);

  const companyOptions: OptionType<string>[] = useMemo(
    () =>
      companies.map((item) => ({
        value: String(item.id),
        label: item.name || item.slug || String(item.id),
      })),
    [companies]
  );

  const categoryOptions: OptionType<string>[] = useMemo(
    () =>
      categories.map((item) => ({
        value: String(item.id),
        label: item.name || String(item.id),
      })),
    [categories]
  );

  const clientOptions: OptionType<string>[] = useMemo(
    () =>
      clients.map((item) => ({
        value: String(item.id),
        label: item.name ? `${item.name}${item.phone ? ` (${item.phone})` : ''}` : String(item.id),
      })),
    [clients]
  );

  const productOptions: OptionType<string>[] = useMemo(
    () =>
      products.map((item) => ({
        value: String(item.id),
        label: item.name || String(item.id),
      })),
    [products]
  );

  const serviceOptions: OptionType<string>[] = useMemo(
    () =>
      services.map((item) => ({
        value: String(item.id),
        label: item.name || String(item.id),
      })),
    [services]
  );

  const showValidSwitch = !isTenantMode && (role === 'admin' || role === 'agent');
  const selectedCurrencyLabel = filters.currency === 'all' ? '' : filters.currency;
  const hasMixedCurrencies = filters.currency === 'all' && (statistics?.breakdowns?.currencies?.length ?? 0) > 1;

  const formatAmount = (value?: string | null): string => {
    const formatted = formatMoney(value ?? '');
    if (!formatted) return '0.00';
    return selectedCurrencyLabel ? `${formatted} ${selectedCurrencyLabel}` : formatted;
  };

  const summaryCards = useMemo(() => {
    if (!statistics) return [];
    const summary = statistics.summary;
    const balanceAmount = Number(summary.balance ?? '0');
    return [
      { label: 'Транзакции', value: String(summary.transactions_count ?? 0) },
      { label: 'Доходные транзакции', value: String(summary.income_transactions_count ?? 0) },
      { label: 'Расходные транзакции', value: String(summary.outcome_transactions_count ?? 0) },
      { label: 'Клиентов с транзакциями', value: String(summary.clients_with_transactions ?? 0) },
      { label: 'Продано единиц товаров', value: String(summary.products_units ?? 0) },
      { label: 'Предоставлено услуг', value: String(summary.services_units ?? 0) },
      { label: 'Доход', value: formatAmount(summary.income_total), accent: 'positive' as const },
      { label: 'Расход', value: formatAmount(summary.outcome_total), accent: 'negative' as const },
      {
        label: 'Баланс',
        value: formatAmount(summary.balance),
        accent: balanceAmount >= 0 ? ('positive' as const) : ('negative' as const),
      },
      { label: 'Сумма скидок', value: formatAmount(summary.discount_total) },
      { label: 'Средний чек', value: formatAmount(summary.average_transaction) },
    ];
  }, [statistics, selectedCurrencyLabel]);

  const trendChartData = useMemo(() => {
    if (!statistics) return [];
    return statistics.trend.map((item) => ({
      period: String(item.period ?? ''),
      incomeValue: toNumber(item.income),
      outcomeValue: toNumber(item.outcome),
      balanceValue: toNumber(item.balance),
    }));
  }, [statistics]);

  const typePieData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.types.map((item) => ({
      label: item.label,
      value: Math.abs(toNumber(item.amount)),
    }));
  }, [statistics]);

  const methodPieData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.methods.map((item) => ({
      label: item.label,
      value: Number(item.count ?? 0),
    }));
  }, [statistics]);

  const currencyPieData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.currencies.map((item) => ({
      label: item.label,
      value: Math.abs(toNumber(item.amount)),
    }));
  }, [statistics]);

  const categoriesBarData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.categories.map((item) => ({
      label: trimLabel(item.name),
      value: Math.abs(toNumber(item.amount)),
    }));
  }, [statistics]);

  const clientsBarData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.clients.map((item) => ({
      label: trimLabel(item.name),
      value: Math.abs(toNumber(item.amount)),
    }));
  }, [statistics]);

  const productsBarData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.products.map((item) => ({
      label: trimLabel(item.name),
      value: Number(item.units ?? 0),
    }));
  }, [statistics]);

  const servicesBarData = useMemo(() => {
    if (!statistics) return [];
    return statistics.breakdowns.services.map((item) => ({
      label: trimLabel(item.name),
      value: Number(item.units ?? 0),
    }));
  }, [statistics]);

  const keyAmountColumns: Column<StatisticsKeyAmountItem>[] = useMemo(
    () => [
      { key: 'label', label: 'Параметр' },
      { key: 'count', label: 'Транзакций' },
      {
        key: 'amount',
        label: 'Сумма',
        render: (row) => formatAmount(row.amount),
      },
    ],
    [selectedCurrencyLabel]
  );

  const namedAmountColumns: Column<StatisticsNamedAmountItem>[] = useMemo(
    () => [
      { key: 'name', label: 'Название' },
      { key: 'count', label: 'Транзакций' },
      {
        key: 'amount',
        label: 'Сумма',
        render: (row) => formatAmount(row.amount),
      },
    ],
    [selectedCurrencyLabel]
  );

  const namedUnitsColumns: Column<StatisticsNamedUnitsItem>[] = useMemo(
    () => [
      { key: 'name', label: 'Название' },
      { key: 'transactions_count', label: 'Транзакций' },
      { key: 'units', label: 'Единиц' },
    ],
    []
  );

  const trendColumns: Column<CompanyStatistics['trend'][number]>[] = useMemo(
    () => [
      { key: 'period', label: 'Период' },
      { key: 'transactions_count', label: 'Транзакций' },
      {
        key: 'income',
        label: 'Доход',
        render: (row) => <span className='text-green-600 font-medium'>{formatAmount(row.income)}</span>,
      },
      {
        key: 'outcome',
        label: 'Расход',
        render: (row) => <span className='text-red-600 font-medium'>{formatAmount(row.outcome)}</span>,
      },
      {
        key: 'balance',
        label: 'Баланс',
        render: (row) => {
          const balance = Number(row.balance ?? '0');
          return (
            <span className={balance >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {formatAmount(row.balance)}
            </span>
          );
        },
      },
    ],
    [selectedCurrencyLabel]
  );

  const resetFilters = () => {
    const defaultValid = !isTenantMode && (role === 'admin' || role === 'agent') ? true : null;
    setCurrencyManuallyChanged(false);
    setFilters({
      dateFrom: '',
      dateTo: '',
      groupBy: 'day',
      type: 'all',
      method: 'all',
      currency: 'all',
      categoryIds: [],
      productIds: [],
      serviceIds: [],
      clientIds: [],
      validOnly: defaultValid,
      top: 8,
    });
  };

  const headerSubtitle = isTenantMode
    ? companyLoading
      ? 'Загрузка компании...'
      : selectedCompanyId
        ? `Транзакций в выборке: ${statistics?.summary.transactions_count ?? 0}`
        : 'Компания не найдена'
    : selectedCompanyId
      ? `Транзакций в выборке: ${statistics?.summary.transactions_count ?? 0}`
      : 'Выберите компанию для анализа';

  return (
    <>
      <section className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Статистика</h1>
          <p className='text-sm text-gray-500'>{headerSubtitle}</p>
        </div>
      </section>

      <div className='mb-5 space-y-4'>
        {!isTenantMode && (
          <div>
            <SelectOption
              label='Компания'
              placeholder='Выберите компанию'
              options={companyOptions}
              value={selectedCompanyId}
              onChange={(value) => {
                setSelectedCompanyId(value);
                setStatistics(null);
                setShowAdvancedFilters(false);
                setCurrencyManuallyChanged(false);
                setFilters((prev) => ({
                  ...prev,
                  currency: 'all',
                }));
              }}
            />
          </div>
        )}

        {selectedCompanyId && (
          <>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
              <InputDefault
                label='С даты'
                type='date'
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />

              <InputDefault
                label='По дату'
                type='date'
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
              />

              <SelectOption
                label='Группировка тренда'
                options={[
                  { value: 'day', label: 'По дням' },
                  { value: 'week', label: 'По неделям' },
                  { value: 'month', label: 'По месяцам' },
                ]}
                value={filters.groupBy}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    groupBy: (value as StatisticsGroupBy | undefined) ?? 'day',
                  }))
                }
              />

              <SelectOption
                label='Тип транзакции'
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'income', label: 'Доход' },
                  { value: 'outcome', label: 'Расход' },
                ]}
                value={filters.type}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    type: (value as FiltersState['type'] | undefined) ?? 'all',
                  }))
                }
              />

              <SelectOption
                label='Метод оплаты'
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'cash', label: 'Наличные' },
                  { value: 'card', label: 'Карта' },
                ]}
                value={filters.method}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    method: (value as FiltersState['method'] | undefined) ?? 'all',
                  }))
                }
              />

              <SelectOption
                label='Валюта'
                options={[
                  { value: 'all', label: 'Все валюты' },
                  { value: 'UZS', label: 'UZS' },
                  { value: 'USD', label: 'USD' },
                ]}
                value={filters.currency}
                onChange={(value) => {
                  setCurrencyManuallyChanged(true);
                  setFilters((prev) => ({
                    ...prev,
                    currency: (value as FiltersState['currency'] | undefined) ?? 'all',
                  }));
                }}
              />
            </div>

            <div className='flex items-center justify-between gap-3'>
              <ButtonDefault type='button' variant='outline' onClick={resetFilters}>
                Сбросить фильтры
              </ButtonDefault>

              <ButtonDefault
                type='button'
                variant={showAdvancedFilters ? 'positive' : 'outline'}
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
              >
                <span className='flex items-center gap-2'>
                  <Funnel className='w-4 h-4' />
                  Доп. фильтры
                </span>
              </ButtonDefault>
            </div>

            {showAdvancedFilters && (
              <div className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <SelectMultiple
                    label='Категории'
                    placeholder='Поиск категории'
                    options={categoryOptions}
                    value={filters.categoryIds}
                    onChange={(value) => setFilters((prev) => ({ ...prev, categoryIds: value as string[] }))}
                  />

                  <SelectMultiple
                    label='Клиенты'
                    placeholder='Поиск клиента'
                    options={clientOptions}
                    value={filters.clientIds}
                    onChange={(value) => setFilters((prev) => ({ ...prev, clientIds: value as string[] }))}
                  />

                  <SelectMultiple
                    label='Продукты'
                    placeholder='Поиск продукта'
                    options={productOptions}
                    value={filters.productIds}
                    onChange={(value) => setFilters((prev) => ({ ...prev, productIds: value as string[] }))}
                  />

                  <SelectMultiple
                    label='Услуги'
                    placeholder='Поиск услуги'
                    options={serviceOptions}
                    value={filters.serviceIds}
                    onChange={(value) => setFilters((prev) => ({ ...prev, serviceIds: value as string[] }))}
                  />
                </div>

                <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
                  <SelectOption
                    label='Top элементов'
                    options={[
                      { value: '5', label: '5' },
                      { value: '8', label: '8' },
                      { value: '10', label: '10' },
                      { value: '20', label: '20' },
                      { value: '50', label: '50' },
                    ]}
                    value={String(filters.top)}
                    onChange={(value) => {
                      const parsed = Number(value ?? 8);
                      setFilters((prev) => ({ ...prev, top: Number.isFinite(parsed) ? parsed : 8 }));
                    }}
                  />

                  {showValidSwitch && filters.validOnly !== null && (
                    <ToggleSwitch
                      checked={filters.validOnly}
                      onChange={(next) => setFilters((prev) => ({ ...prev, validOnly: next }))}
                      label='Показывать'
                      onLabel='Валидные'
                      offLabel='Невалидные'
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && <div className='mb-4 text-sm text-red-600'>{error}</div>}

      {!selectedCompanyId ? (
        <EmptyState text={isTenantMode ? 'Компания не найдена' : 'Выберите компанию для просмотра статистики'} />
      ) : loading ? (
        <EmptyState text='Загрузка статистики...' />
      ) : !statistics ? (
        <EmptyState text='Нет данных по выбранным фильтрам.' />
      ) : (
        <section className='space-y-6'>
          {!isTenantMode && selectedCompany && (
            <div className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm'>
              <h2 className='text-lg font-medium'>{selectedCompany.name || `Компания ${selectedCompanyId}`}</h2>
              <p className='text-sm text-gray-500'>Период и срез данных задаются фильтрами выше.</p>
            </div>
          )}

          {hasMixedCurrencies && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
              В выборке есть несколько валют. Для точных сумм отфильтруйте статистику по одной валюте.
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
            {summaryCards.map((item) => (
              <SummaryCard key={item.label} label={item.label} value={item.value} accent={item.accent} />
            ))}
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-3 gap-4'>
            <ChartCard title='Структура по типам' hint='Распределение сумм по типам транзакций'>
              {typePieData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <div className='flex justify-center'>
                  <PieChart data={typePieData} size={240} />
                </div>
              )}
            </ChartCard>

            <ChartCard title='Структура по методам' hint='Распределение по количеству транзакций'>
              {methodPieData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <div className='flex justify-center'>
                  <PieChart data={methodPieData} size={240} />
                </div>
              )}
            </ChartCard>

            <ChartCard title='Структура по валютам' hint='Распределение сумм по валютам'>
              {currencyPieData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <div className='flex justify-center'>
                  <PieChart data={currencyPieData} size={240} />
                </div>
              )}
            </ChartCard>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <ChartCard title='Динамика доходов' hint='По выбранной группировке периода'>
              {trendChartData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <div className='h-[280px]'>
                  <LineChart data={trendChartData} xKey='period' yKey='incomeValue' lineColor='#16a34a' fillColor='#16a34a' />
                </div>
              )}
            </ChartCard>

            <ChartCard title='Динамика баланса' hint='Доход минус расход'>
              {trendChartData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <div className='h-[280px]'>
                  <LineChart data={trendChartData} xKey='period' yKey='balanceValue' lineColor='#2563eb' fillColor='#2563eb' />
                </div>
              )}
            </ChartCard>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <ChartCard title='Доход по категориям (Top)'>
              {categoriesBarData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <BarGraph data={categoriesBarData} height={320} />
              )}
            </ChartCard>

            <ChartCard title='Доход по клиентам (Top)'>
              {clientsBarData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <BarGraph data={clientsBarData} barColor='#14b8a6' height={320} />
              )}
            </ChartCard>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <ChartCard title='Продажи продуктов (Top)'>
              {productsBarData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <BarGraph data={productsBarData} barColor='#7c3aed' height={320} />
              )}
            </ChartCard>

            <ChartCard title='Предоставления услуг (Top)'>
              {servicesBarData.length === 0 ? (
                <div className='text-sm text-gray-500'>Нет данных.</div>
              ) : (
                <BarGraph data={servicesBarData} barColor='#f59e0b' height={320} />
              )}
            </ChartCard>
          </div>

          <div className='space-y-2'>
            <h2 className='text-lg font-medium'>Динамика</h2>
            {statistics.trend.length === 0 ? (
              <EmptyState text='Нет данных для построения тренда.' />
            ) : (
              <TableDefault columns={trendColumns} data={statistics.trend} className='bg-transparent' />
            )}
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-3 gap-4'>
            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>По типам</h2>
              {statistics.breakdowns.types.length === 0 ? (
                <EmptyState text='Нет данных.' />
              ) : (
                <TableDefault columns={keyAmountColumns} data={statistics.breakdowns.types} className='bg-transparent' />
              )}
            </div>

            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>По методам оплаты</h2>
              {statistics.breakdowns.methods.length === 0 ? (
                <EmptyState text='Нет данных.' />
              ) : (
                <TableDefault columns={keyAmountColumns} data={statistics.breakdowns.methods} className='bg-transparent' />
              )}
            </div>

            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>По валютам</h2>
              {statistics.breakdowns.currencies.length === 0 ? (
                <EmptyState text='Нет данных.' />
              ) : (
                <TableDefault columns={keyAmountColumns} data={statistics.breakdowns.currencies} className='bg-transparent' />
              )}
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>Категории (Top)</h2>
              {statistics.breakdowns.categories.length === 0 ? (
                <EmptyState text='Нет данных по категориям.' />
              ) : (
                <TableDefault columns={namedAmountColumns} data={statistics.breakdowns.categories} className='bg-transparent' />
              )}
            </div>

            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>Клиенты (Top)</h2>
              {statistics.breakdowns.clients.length === 0 ? (
                <EmptyState text='Нет данных по клиентам.' />
              ) : (
                <TableDefault columns={namedAmountColumns} data={statistics.breakdowns.clients} className='bg-transparent' />
              )}
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>Продукты (Top)</h2>
              {statistics.breakdowns.products.length === 0 ? (
                <EmptyState text='Нет данных по продуктам.' />
              ) : (
                <TableDefault columns={namedUnitsColumns} data={statistics.breakdowns.products} className='bg-transparent' />
              )}
            </div>

            <div className='space-y-2'>
              <h2 className='text-lg font-medium'>Услуги (Top)</h2>
              {statistics.breakdowns.services.length === 0 ? (
                <EmptyState text='Нет данных по услугам.' />
              ) : (
                <TableDefault columns={namedUnitsColumns} data={statistics.breakdowns.services} className='bg-transparent' />
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
