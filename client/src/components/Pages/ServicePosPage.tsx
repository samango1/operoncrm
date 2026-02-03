'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Company } from '@/types/api/companies';
import type { Service } from '@/types/api/services';
import type { Client } from '@/types/api/clients';
import type { Transaction, TransactionMethod, TransactionCurrency } from '@/types/api/transactions';
import { createCompanyTransaction, getCompanies, getCompanyBySlug, getCompanyServices, getCompanyClients } from '@/lib/api';
import { buildTashkentDateTime, getTashkentNowParts } from '@/lib/datetime';
import { compareDecimalStrings, formatMoney, isValidDecimal, maskDecimalInput, normalizeDecimalInput } from '@/lib/decimal';

import SelectOption from '@/components/Inputs/SelectOption';
import SearchInput from '@/components/Inputs/SearchInput';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import Pagination from '@/components/Layouts/Pagination';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import InputDefault from '@/components/Inputs/InputDefault';
import TextAreaDefault from '@/components/Inputs/TextAreaDefault';
import PosServiceCard from '@/components/Cards/ServiceCard';
import ConfirmModalWindow from '@/components/ModalWindows/ConfirmModalWindow';
import OptionalSection from '@/components/Containers/OptionalSection';
import { preferenceIds } from '@/lib/preferencesCookies';
import { Funnel } from 'lucide-react';

const panelClasses = 'rounded-2xl border border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-sm';

type ServicePosPageProps = {
  tenantSlug?: string;
};

type CurrencyState = {
  currency?: TransactionCurrency;
  mixed: boolean;
};

type SelectedService = {
  service: Service;
  qty: number;
};

const parseAmount = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const normalized = normalizeDecimalInput(String(value));
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toAmountString = (value: number): string => {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
};

const buildDiscountError = (discountInput: string, subtotal: string) => {
  if (discountInput === '') return null;
  const normalizedDiscount = normalizeDecimalInput(discountInput);
  if (!isValidDecimal(normalizedDiscount, { maxFractionDigits: 2 })) {
    return 'Введите корректную скидку';
  }
  if (compareDecimalStrings(normalizedDiscount, '0') < 0) {
    return 'Скидка должна быть не меньше 0';
  }
  if (compareDecimalStrings(normalizedDiscount, subtotal) > 0) {
    return 'Скидка не может быть больше суммы';
  }
  return null;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

export default function ServicePosPage({ tenantSlug }: ServicePosPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [servicesCount, setServicesCount] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [activeOnly, setActiveOnly] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<TransactionMethod>('cash');
  const [note, setNote] = useState('');
  const [servicesStartDate, setServicesStartDate] = useState(getTashkentNowParts().date);
  const [servicesStartTime, setServicesStartTime] = useState(getTashkentNowParts().time);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isTenantMode = Boolean(tenantSlug);

  useEffect(() => {
    if (isTenantMode) return;
    const fetchCompanies = async () => {
      setCompanyLoading(true);
      setCompanyError(null);
      try {
        const res = await getCompanies({ page: 1, page_size: 1000 });
        setCompanies(res.results as Company[]);
      } catch (err) {
        console.error('getCompanies error:', err);
        setCompanyError('Не удалось загрузить компании');
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchCompanies();
  }, [isTenantMode]);

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchCompany = async () => {
      setCompanyLoading(true);
      setCompanyError(null);
      try {
        const res = await getCompanyBySlug(tenantSlug);
        setCompanyId(res?.id ? String(res.id) : undefined);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setCompanyId(undefined);
        setCompanyError('Не удалось определить компанию');
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchCompany();
  }, [tenantSlug]);

  useEffect(() => {
    setSelectedServices([]);
    setDiscount('');
    setNote('');
    setSubmitError(null);
    setSubmitSuccess(null);
    setClientId(undefined);
  }, [companyId]);

  const fetchServices = async (id: string, page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyServices(id, { page, page_size: ps, search: q });
      setServices(res.results as Service[]);
      setServicesCount(res.count ?? 0);
    } catch (err) {
      console.error('getCompanyServices error:', err);
      setError('Не удалось загрузить услуги');
      setServices([]);
      setServicesCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async (id: string) => {
    try {
      const res = await getCompanyClients(id, { page: 1, page_size: 1000 });
      setClients(res.results as Client[]);
    } catch (err) {
      console.error('getCompanyClients error:', err);
      setClients([]);
    }
  };

  useEffect(() => {
    if (!companyId) {
      setServices([]);
      setServicesCount(0);
      setClients([]);
      return;
    }
    fetchServices(companyId, currentPage, pageSize, search);
    fetchClients(companyId);
  }, [companyId, currentPage, pageSize, search]);

  useEffect(() => {
    if (!clientId) return;
    const exists = clients.some((c) => String(c.id) === String(clientId));
    if (!exists) {
      setClientId(undefined);
    }
  }, [clients, clientId]);

  const companyOptions = useMemo(
    () =>
      companies.map((item) => ({
        value: String(item.id),
        label: item.name || item.slug || String(item.id),
      })),
    [companies]
  );

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: c.name ? `${c.name}${c.phone ? ` (${c.phone})` : ''}` : String(c.id),
      })),
    [clients]
  );

  const selectedServiceIds = useMemo(() => new Set(selectedServices.map((s) => String(s.service.id))), [selectedServices]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (activeOnly && !service.active) return false;
      return true;
    });
  }, [services, activeOnly]);

  const currencyState = useMemo((): CurrencyState => {
    if (selectedServices.length === 0) return { currency: undefined, mixed: false };
    const currencies = new Set(selectedServices.map((s) => s.service.currency).filter(Boolean));
    if (currencies.size === 0) return { currency: undefined, mixed: false };
    if (currencies.size > 1) return { currency: undefined, mixed: true };
    return { currency: Array.from(currencies)[0] as TransactionCurrency, mixed: false };
  }, [selectedServices]);

  const subtotalValue = useMemo(() => {
    return selectedServices.reduce((sum, item) => sum + parseAmount(item.service.price) * item.qty, 0);
  }, [selectedServices]);

  const subtotalRaw = useMemo(() => toAmountString(subtotalValue), [subtotalValue]);

  const discountError = useMemo(() => buildDiscountError(discount, subtotalRaw), [discount, subtotalRaw]);

  const discountValue = useMemo(() => {
    if (discountError) return 0;
    return parseAmount(normalizeDecimalInput(discount || '0'));
  }, [discount, discountError]);

  const totalValue = useMemo(() => {
    return Math.max(0, subtotalValue - discountValue);
  }, [subtotalValue, discountValue]);

  const displayCurrency = useMemo(() => {
    return currencyState.currency || services[0]?.currency || 'UZS';
  }, [currencyState.currency, services]);

  const confirmDescription = useMemo(() => {
    if (selectedServices.length === 0) return null;
    return (
      <div className='space-y-1'>
        <div>Позиций: {selectedServices.length}</div>
        <div>
          Сумма: {formatMoney(toAmountString(totalValue))} {displayCurrency}
        </div>
      </div>
    );
  }, [selectedServices.length, totalValue, displayCurrency]);

  const selectionHint = useMemo(() => {
    if (!companyId) return 'Сначала выберите компанию, чтобы начать продажу услуг';
    if (loading) return 'Загрузка каталога услуг...';
    if (services.length === 0) return 'Нет доступных услуг для этой компании';
    return '';
  }, [companyId, loading, services.length]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(page);
    } else {
      setCurrentPage(page);
    }
  };

  const checkoutDisabled =
    submitting ||
    !companyId ||
    selectedServices.length === 0 ||
    currencyState.mixed ||
    !clientId ||
    !servicesStartDate ||
    !servicesStartTime;

  const handleToggleService = (service: Service) => {
    const id = String(service.id);
    setSelectedServices((prev) => {
      const exists = prev.find((item) => String(item.service.id) === id);
      if (exists) {
        return prev.filter((item) => String(item.service.id) !== id);
      }
      return [...prev, { service, qty: 1 }];
    });
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleQtyChange = (serviceId: string, nextQty: number) => {
    setSelectedServices((prev) =>
      prev.map((item) =>
        String(item.service.id) === serviceId
          ? { ...item, qty: Number.isFinite(nextQty) && nextQty > 0 ? Math.floor(nextQty) : 1 }
          : item
      )
    );
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices((prev) => prev.filter((item) => String(item.service.id) !== serviceId));
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleClear = () => {
    setSelectedServices([]);
    setDiscount('');
    setNote('');
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleCheckout = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!companyId) {
      setSubmitError('Сначала выберите компанию');
      return;
    }

    if (!clientId) {
      setSubmitError('Выберите клиента для предоставления услуг');
      return;
    }

    if (selectedServices.length === 0) {
      setSubmitError('Выберите услуги для продажи');
      return;
    }

    if (currencyState.mixed || !currencyState.currency) {
      setSubmitError('Нельзя создать продажу с разными валютами');
      return;
    }

    const normalizedSubtotal = normalizeDecimalInput(String(subtotalRaw));
    if (compareDecimalStrings(normalizedSubtotal, '0') <= 0) {
      setSubmitError('Сумма продажи должна быть больше 0');
      return;
    }

    if (discountError) {
      setSubmitError(discountError);
      return;
    }

    const normalizedDiscount = discount === '' ? '0' : normalizeDecimalInput(discount);

    const now = getTashkentNowParts();
    const dateTimeValue = buildTashkentDateTime(now.date, now.time);
    if (!dateTimeValue) {
      setSubmitError('Не удалось определить дату продажи');
      return;
    }

    const servicesStart = buildTashkentDateTime(servicesStartDate, servicesStartTime);
    if (!servicesStart) {
      setSubmitError('Укажите дату начала услуг');
      return;
    }

    const expandedServices = selectedServices.flatMap((item) =>
      Array.from({ length: item.qty }, () => String(item.service.id))
    );

    const payload: Partial<Transaction> = {
      initial_amount: normalizedSubtotal,
      discount_amount: normalizedDiscount,
      type: 'income',
      method,
      currency: currencyState.currency,
      date: dateTimeValue,
      description: note || undefined,
      client: clientId,
      services: expandedServices,
      services_starts_at: servicesStart,
      company: companyId,
    };

    setSubmitting(true);
    try {
      await createCompanyTransaction(String(companyId), payload);
      setSubmitSuccess('Предоставление услуг успешно создана');
      setSelectedServices([]);
      setDiscount('');
      setNote('');
    } catch (err) {
      console.error('createCompanyTransaction error:', err);
      setSubmitError('Не удалось создать продажу');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCheckout = async () => {
    setConfirmOpen(false);
    await handleCheckout();
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutDisabled) return;
    setConfirmOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

      if (isEditableTarget(e.target)) return;

      if (confirmOpen) {
        if (checkoutDisabled) return;
        e.preventDefault();
        handleConfirmCheckout();
        return;
      }

      if (checkoutDisabled) return;
      e.preventDefault();
      setConfirmOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkoutDisabled, confirmOpen]);

  const methodOptions = useMemo(
    () => [
      { value: 'cash', label: 'Наличные' },
      { value: 'card', label: 'Карта' },
    ],
    []
  );

  return (
    <div className='space-y-6'>
      <section className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Предоставление услуг</h1>
        </div>
      </section>

      <section className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-4'>
          {!isTenantMode && (
            <div className={panelClasses + ' p-4'}>
              <SelectOption
                label='Компания'
                placeholder={companyLoading ? 'Загрузка...' : 'Выберите компанию'}
                options={companyOptions}
                value={companyId}
                onChange={(value) => {
                  setCompanyId(value);
                  setCurrentPage(1);
                  setSearch('');
                }}
                disabled={companyLoading}
              />
              {companyError && <div className='mt-2 text-sm text-red-600'>{companyError}</div>}
            </div>
          )}

          <div className={panelClasses + ' p-4'}>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='text-xs text-gray-500'>
                {companyId ? `Показано ${filteredServices.length} из ${servicesCount}` : 'Компания не выбрана'}
              </div>
              <div className='text-xs text-gray-500'>{companyId ? `Страница ${currentPage}` : 'Выберите компанию'}</div>
            </div>
            <div className='mt-3 flex items-center justify-between gap-4'>
              <SearchInput initialValue={search} onSearch={handleSearch} placeholder='Поиск по названию или описанию' />
              <ButtonDefault
                type='button'
                onClick={() => setShowFilters((prev) => !prev)}
                aria-label='Показать фильтры'
                variant={showFilters ? 'positive' : 'outline'}
              >
                <Funnel />
              </ButtonDefault>
            </div>
            {showFilters && (
              <div className='mt-3 rounded-lg border border-gray-200 bg-white/60 p-3'>
                <div className='flex flex-wrap items-center gap-4'>
                  <ToggleSwitch
                    checked={activeOnly}
                    onChange={setActiveOnly}
                    label='Статус'
                    onLabel='Только активные'
                    offLabel='Все услуги'
                  />
                </div>
              </div>
            )}
          </div>

          {error && <div className='text-red-600'>{error}</div>}

          {!companyId ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 text-gray-500'>
              {selectionHint}
            </div>
          ) : loading ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 text-gray-500'>
              Загрузка услуг...
            </div>
          ) : filteredServices.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 text-gray-500'>
              {search ? 'Нет услуг, подходящих под запрос' : 'Нет доступных услуг'}
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {filteredServices.map((service) => (
                <PosServiceCard
                  key={String(service.id)}
                  service={service}
                  selected={selectedServiceIds.has(String(service.id))}
                  disabled={!service.active}
                  onToggle={handleToggleService}
                />
              ))}
            </div>
          )}

          {companyId && servicesCount > 0 && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              total={servicesCount}
              onPageChange={handlePageChange}
              pageSizeOptions={[12, 24, 48, 96]}
            />
          )}
        </div>

        <aside className='space-y-4'>
          <div className={panelClasses + ' p-4'}>
            <div className='flex items-center justify-between gap-4'>
              <h2 className='text-lg font-semibold'>Чек</h2>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-gray-500'>{selectedServices.length} поз.</span>
                <ButtonDefault
                  type='button'
                  variant='outline'
                  className='px-2 py-1 text-xs'
                  onClick={handleClear}
                  disabled={selectedServices.length === 0}
                >
                  Очистить
                </ButtonDefault>
              </div>
            </div>

            <div className='mt-4 space-y-3'>
              {selectedServices.length === 0 ? (
                <div className='rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-500'>
                  Выберите услуги слева, чтобы сформировать чек
                </div>
              ) : (
                <div className='space-y-2 max-h-35 overflow-y-auto pr-1'>
                  {selectedServices.map((item) => (
                    <div
                      key={String(item.service.id)}
                      className='rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 space-y-2'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <div>
                          <div className='text-sm font-medium text-gray-900'>{item.service.name}</div>
                          <div className='text-xs text-gray-500'>
                            {formatMoney(item.service.price)} {item.service.currency}
                          </div>
                        </div>
                        <ButtonDefault
                          variant='outline'
                          className='px-2 py-1 text-xs'
                          onClick={() => handleRemoveService(String(item.service.id))}
                        >
                          ×
                        </ButtonDefault>
                      </div>
                      <div className='flex items-center justify-between gap-3 text-xs text-gray-500'>
                        <span>Количество</span>
                        <div className='flex items-center gap-2'>
                          <InputDefault
                            type='number'
                            min={1}
                            step={1}
                            value={item.qty}
                            onChange={(e) => handleQtyChange(String(item.service.id), Number(e.target.value))}
                            className='w-20'
                          />
                          <ButtonDefault
                            type='button'
                            variant='danger'
                            className='px-2 py-1 text-xs'
                            onClick={() => handleQtyChange(String(item.service.id), Math.max(1, item.qty - 1))}
                          >
                            -
                          </ButtonDefault>
                          <ButtonDefault
                            type='button'
                            variant='positive'
                            className='px-2 py-1 text-xs'
                            onClick={() => handleQtyChange(String(item.service.id), item.qty + 1)}
                          >
                            +
                          </ButtonDefault>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className='mt-4 space-y-2 text-sm text-gray-600'>
                <div className='flex items-center justify-between'>
                  <span>Подытог</span>
                  <span className='text-gray-900'>
                    {formatMoney(subtotalRaw)} {displayCurrency}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span>Скидка</span>
                  <span className='text-gray-900'>
                    {formatMoney(discountValue)} {displayCurrency}
                  </span>
                </div>
                <div className='flex items-center justify-between text-base font-semibold text-gray-900'>
                  <span>Итого</span>
                  <span>
                    {formatMoney(toAmountString(totalValue))} {displayCurrency}
                  </span>
                </div>
              </div>

              {currencyState.mixed && (
                <div className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
                  В чеке смешаны услуги с разной валютой. Уберите услуги в другой валюте.
                </div>
              )}
            </div>
          </div>

          <form className={panelClasses + ' p-4 space-y-4'} onSubmit={handleCheckoutSubmit}>
            <h3 className='text-base font-semibold'>Оплата</h3>

            <SelectOption
              label='Клиент'
              placeholder={
                companyId ? (clients.length === 0 ? 'Клиенты не найдены' : 'Выберите клиента') : 'Сначала выберите компанию'
              }
              options={clientOptions}
              value={clientId}
              onChange={(value) => setClientId(value as string | undefined)}
              disabled={!companyId || clients.length === 0}
            />

            <SelectOption
              label='Метод оплаты'
              options={methodOptions}
              value={method}
              onChange={(value) => setMethod((value as TransactionMethod) ?? 'cash')}
            />

            <InputDefault
              label='Скидка'
              type='text'
              inputMode='decimal'
              placeholder='0.00'
              value={discount}
              onChange={(e) => setDiscount(maskDecimalInput(e.target.value, { maxFractionDigits: 2 }))}
              error={discountError ?? undefined}
            />

            <TextAreaDefault
              label='Комментарий'
              placeholder='Например, номер заказа или примечание'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />

            <OptionalSection preferenceId={preferenceIds.optionalSection.servicePosExtra}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <InputDefault
                  label='Начало услуг (дата)'
                  type='date'
                  value={servicesStartDate}
                  onChange={(e) => setServicesStartDate(e.target.value)}
                />
                <InputDefault
                  label='Начало услуг'
                  type='time'
                  value={servicesStartTime}
                  onChange={(e) => setServicesStartTime(e.target.value)}
                  step={60}
                />
              </div>
            </OptionalSection>

            {submitError && <div className='text-sm text-red-600'>{submitError}</div>}
            {submitSuccess && <div className='text-sm text-green-600'>{submitSuccess}</div>}

            <ButtonDefault
              type='submit'
              variant={checkoutDisabled ? 'disabled' : 'positive'}
              disabled={checkoutDisabled}
              className='w-full'
            >
              {submitting ? 'Создание продажи...' : 'Создать продажу'}
            </ButtonDefault>
          </form>
        </aside>
      </section>

      <ConfirmModalWindow
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmCheckout}
        title='Подтвердить продажу'
        description={confirmDescription}
        confirmText='Создать продажу'
        loading={submitting}
        disableConfirm={checkoutDisabled}
      />
    </div>
  );
}
