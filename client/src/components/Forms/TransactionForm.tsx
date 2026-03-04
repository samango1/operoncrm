'use client';

import React, { useEffect, useRef, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import TextAreaDefault from '../Inputs/TextAreaDefault';
import SelectOption, { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import SelectMultiple from '@/components/Inputs/SelectMultiple';
import OptionalField from '@/components/Inputs/OptionalField';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import ToggleBadgeGroup from '@/components/Buttons/ToggleBadgeGroup';
import { preferencesKeys } from '@/lib/preferencesCookies';
import type { Company } from '@/types/api/companies';
import type { Transaction, TransactionCategory } from '@/types/api/transactions';
import type { Client } from '@/types/api/clients';
import type { Product } from '@/types/api/products';
import type { Service } from '@/types/api/services';
import {
  createCompanyTransaction,
  updateCompanyTransaction,
  getCompanyTransactionCategories,
  deleteCompanyTransaction,
  deleteTransaction,
} from '@/lib/api';
import {
  compareDecimalStrings,
  formatMoney,
  isValidDecimal,
  maskDecimalInput,
  normalizeDecimalInput,
  toDecimalString,
} from '@/lib/decimal';
import { buildTashkentDateTime, getTashkentNowParts, splitDateTimeToTashkent } from '@/lib/datetime';
import { t } from '@/i18n';
type Props = {
  companies: Company[];
  clients?: Client[];
  products?: Product[];
  services?: Service[];
  defaultCompanyId?: string;
  transaction?: Transaction;
  onCancel: () => void;
  onSuccess: (created?: Transaction) => void | Promise<void>;
};
export default function TransactionForm({
  companies,
  clients = [],
  products = [],
  services = [],
  defaultCompanyId,
  transaction,
  onCancel,
  onSuccess,
}: Props) {
  const initialNowRef = useRef(getTashkentNowParts());
  const initialCompanyId = defaultCompanyId ? String(defaultCompanyId) : undefined;
  const [companyId, setCompanyId] = useState<string | undefined>(initialCompanyId);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [initialAmount, setInitialAmount] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [type, setType] = useState<'income' | 'outcome'>('income');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [date, setDate] = useState<string>(initialNowRef.current.date);
  const [time, setTime] = useState<string>(initialNowRef.current.time);
  const [description, setDescription] = useState<string>('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [servicesStartDate, setServicesStartDate] = useState<string>(initialNowRef.current.date);
  const [servicesStartTime, setServicesStartTime] = useState<string>(initialNowRef.current.time);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const prevCompanyIdRef = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCompanyLocked = Boolean(defaultCompanyId);
  const extractCategoryIds = (value?: Transaction['categories']): string[] => {
    if (!value) return [];
    return (value as Array<TransactionCategory | string>)
      .map((item) => (typeof item === 'string' ? item : String(item?.id ?? '')))
      .filter((id) => id);
  };
  const extractProductSelections = (
    value?: Transaction['products']
  ): {
    ids: string[];
    quantities: Record<string, number>;
  } => {
    if (!value)
      return {
        ids: [],
        quantities: {},
      };
    const counts: Record<string, number> = {};
    (value as Array<Product | string>)
      .map((item) => (typeof item === 'string' ? item : String(item?.id ?? '')))
      .filter((id) => id)
      .forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
    return {
      ids: Object.keys(counts),
      quantities: counts,
    };
  };
  const extractServiceSelections = (
    value?: Transaction['services']
  ): {
    ids: string[];
    quantities: Record<string, number>;
  } => {
    if (!value)
      return {
        ids: [],
        quantities: {},
      };
    const counts: Record<string, number> = {};
    (value as Array<Service | string>)
      .map((item) => (typeof item === 'string' ? item : String(item?.id ?? '')))
      .filter((id) => id)
      .forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
    return {
      ids: Object.keys(counts),
      quantities: counts,
    };
  };
  useEffect(() => {
    if (!transaction) return;
    setCompanyId(
      typeof transaction.company === 'string' ? transaction.company : String((transaction.company as Company)?.id ?? undefined)
    );
    setClientId(
      typeof transaction.client === 'string'
        ? transaction.client
        : transaction.client
          ? String((transaction.client as Client)?.id ?? undefined)
          : undefined
    );
    setInitialAmount(toDecimalString(transaction.initial_amount ?? transaction.amount ?? ''));
    setDiscount(toDecimalString(transaction.discount_amount ?? '0'));
    setType(transaction.type ?? 'income');
    setMethod(transaction.method ?? 'cash');
    setCurrency(transaction.currency ?? 'UZS');
    const dateTime = splitDateTimeToTashkent(transaction.date ?? transaction.created_at ?? null);
    setDate(dateTime.date);
    setTime(dateTime.time);
    setDescription(transaction.description ?? '');
    setCategoryIds(extractCategoryIds(transaction.categories));
    const productSelection = extractProductSelections(transaction.products);
    setProductIds(productSelection.ids);
    setProductQuantities(productSelection.quantities);
    const serviceSelection = extractServiceSelections(transaction.services);
    setServiceIds(serviceSelection.ids);
    setServiceQuantities(serviceSelection.quantities);
    if (transaction.services_starts_at) {
      const serviceDateTime = splitDateTimeToTashkent(transaction.services_starts_at);
      setServicesStartDate(serviceDateTime.date);
      setServicesStartTime(serviceDateTime.time);
    } else {
      setServicesStartDate(initialNowRef.current.date);
      setServicesStartTime(initialNowRef.current.time);
    }
  }, [transaction]);
  const companyOptions: OptionType<string>[] = companies.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));
  const getClientCompanyId = (c: Client): string | undefined => {
    if (!c.company) return undefined;
    return typeof c.company === 'string' ? c.company : String((c.company as Company)?.id ?? undefined);
  };
  const filteredClients = (clients ?? []).filter((c) => {
    if (!companyId) return false;
    const cid = getClientCompanyId(c);
    return cid === companyId;
  });
  const clientOptions: OptionType<string>[] = filteredClients.map((c) => ({
    value: String(c.id),
    label: c.name ? `${c.name}${c.phone ? ` (${c.phone})` : ''}` : String(c.id),
  }));
  const getProductCompanyId = (p: Product): string | undefined => {
    if (!p.company) return undefined;
    return typeof p.company === 'string' ? p.company : String((p.company as Company)?.id ?? undefined);
  };
  const filteredProducts = (products ?? []).filter((p) => {
    if (!companyId) return false;
    const cid = getProductCompanyId(p);
    return cid === companyId;
  });
  const productOptions: OptionType<string>[] = filteredProducts.map((p) => ({
    value: String(p.id),
    label: p.name ? `${p.name}${p.price ? ` (${formatMoney(p.price)} ${p.currency ?? ''})` : ''}` : String(p.id),
  }));
  const getServiceCompanyId = (s: Service): string | undefined => {
    if (!s.company) return undefined;
    return typeof s.company === 'string' ? s.company : String((s.company as Company)?.id ?? undefined);
  };
  const filteredServices = (services ?? []).filter((s) => {
    if (!companyId) return false;
    const cid = getServiceCompanyId(s);
    return cid === companyId;
  });
  const serviceOptions: OptionType<string>[] = filteredServices.map((s) => ({
    value: String(s.id),
    label: s.name ? `${s.name}${s.price ? ` (${formatMoney(s.price)} ${s.currency ?? ''})` : ''}` : String(s.id),
  }));
  const fetchCategories = async (company: string) => {
    setCategoriesLoading(true);
    try {
      const res = await getCompanyTransactionCategories(company, {
        page: 1,
        page_size: 1000,
      });
      setCategories((res.results ?? res) as TransactionCategory[]);
    } catch (err) {
      console.error('fetchCategories error:', err);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };
  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      setCategoryIds([]);
      return;
    }
    fetchCategories(companyId);
  }, [companyId]);
  useEffect(() => {
    if (categories.length === 0 || categoryIds.length === 0) return;
    const validIds = new Set(categories.map((c) => String(c.id)));
    const next = categoryIds.filter((id) => validIds.has(String(id)));
    if (next.length !== categoryIds.length) {
      setCategoryIds(next);
    }
  }, [categories, categoryIds]);
  useEffect(() => {
    if (prevCompanyIdRef.current !== companyId) {
      prevCompanyIdRef.current = companyId;
      if (productIds.length > 0) {
        setProductIds([]);
        setProductQuantities({});
      }
      if (serviceIds.length > 0) {
        setServiceIds([]);
        setServiceQuantities({});
      }
      return;
    }
    if (!companyId) {
      if (productIds.length > 0) {
        setProductIds([]);
        setProductQuantities({});
      }
      if (serviceIds.length > 0) {
        setServiceIds([]);
        setServiceQuantities({});
      }
      return;
    }
    if (productIds.length === 0) return;
    const validIds = new Set(filteredProducts.map((p) => String(p.id)));
    const next = productIds.filter((id) => validIds.has(String(id)));
    if (next.length !== productIds.length) {
      const nextQuantities: Record<string, number> = {};
      next.forEach((id) => {
        nextQuantities[id] = productQuantities[id] ?? 1;
      });
      setProductIds(next);
      setProductQuantities(nextQuantities);
    }
  }, [filteredProducts, productIds, productQuantities, companyId, serviceIds]);
  useEffect(() => {
    if (!companyId) {
      if (serviceIds.length > 0) {
        setServiceIds([]);
        setServiceQuantities({});
      }
      return;
    }
    if (serviceIds.length === 0) return;
    const validIds = new Set(filteredServices.map((s) => String(s.id)));
    const next = serviceIds.filter((id) => validIds.has(String(id)));
    if (next.length !== serviceIds.length) {
      const nextQuantities: Record<string, number> = {};
      next.forEach((id) => {
        nextQuantities[id] = serviceQuantities[id] ?? 1;
      });
      setServiceIds(next);
      setServiceQuantities(nextQuantities);
    }
  }, [filteredServices, serviceIds, serviceQuantities, companyId]);
  useEffect(() => {
    if (!clientId) return;
    const exists = filteredClients.some((c) => String(c.id) === String(clientId));
    if (!exists) {
      setClientId(undefined);
    }
  }, [companyId, clients]);
  const typeOptions: OptionType<string>[] = [
    {
      value: 'income',
      label: t('ui.income'),
    },
    {
      value: 'outcome',
      label: t('ui.consumption'),
    },
  ];
  const methodOptions: OptionType<string>[] = [
    {
      value: 'cash',
      label: t('ui.cash'),
    },
    {
      value: 'card',
      label: t('ui.card'),
    },
  ];
  const currencyOptions: OptionType<string>[] = [
    {
      value: 'UZS',
      label: 'UZS',
    },
    {
      value: 'USD',
      label: 'USD',
    },
  ];
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!companyId) {
      setError(t('ui.select_a_company'));
      return;
    }
    const normalizedInitial = normalizeDecimalInput(initialAmount);
    if (
      !isValidDecimal(normalizedInitial, {
        maxFractionDigits: 2,
      }) ||
      compareDecimalStrings(normalizedInitial, '0') <= 0
    ) {
      setError(t('ui.enter_the_correct_amount'));
      return;
    }
    const normalizedDiscount = discount === '' ? '0' : normalizeDecimalInput(discount);
    if (
      discount !== '' &&
      !isValidDecimal(normalizedDiscount, {
        maxFractionDigits: 2,
      })
    ) {
      setError(t('ui.enter_a_correct_discount'));
      return;
    }
    if (compareDecimalStrings(normalizedDiscount, '0') < 0) {
      setError(t('ui.the_discount_must_be_at_least_0'));
      return;
    }
    if (compareDecimalStrings(normalizedDiscount, normalizedInitial) > 0) {
      setError(t('ui.the_discount_cannot_exceed_the_amount'));
      return;
    }
    const dateTimeValue = buildTashkentDateTime(date, time);
    if (!dateTimeValue) {
      setError(t('ui.please_enter_a_date'));
      return;
    }
    const expandedProducts = productIds.flatMap((id) => {
      const qty = productQuantities[id] ?? 1;
      const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      return Array.from(
        {
          length: safeQty,
        },
        () => id
      );
    });
    const expandedServices = serviceIds.flatMap((id) => {
      const qty = serviceQuantities[id] ?? 1;
      const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      return Array.from(
        {
          length: safeQty,
        },
        () => id
      );
    });
    let servicesStartsAtValue = '';
    if (!servicesLocked && expandedServices.length > 0) {
      if (!clientId) {
        setError(t('ui.for_services_you_need_to_select_a_client'));
        return;
      }
      servicesStartsAtValue = buildTashkentDateTime(servicesStartDate, servicesStartTime);
      if (!servicesStartsAtValue) {
        setError(t('ui.specify_the_start_date_of_services'));
        return;
      }
    }
    const payload: Partial<Transaction> = {
      initial_amount: normalizedInitial,
      type,
      method,
      currency,
      date: dateTimeValue,
      description: description || undefined,
      client: clientId || undefined,
      categories: categoryIds,
      products: expandedProducts,
      company: companyId ?? undefined,
      discount_amount: normalizedDiscount,
    };
    if (!servicesLocked && expandedServices.length > 0) {
      payload.services = expandedServices;
      payload.services_starts_at = servicesStartsAtValue;
    }
    try {
      setLoading(true);
      let resp: Transaction;
      if (transaction && transaction.id) {
        resp = await updateCompanyTransaction(String(companyId), String(transaction.id), payload);
      } else {
        resp = await createCompanyTransaction(String(companyId), payload);
      }
      onCancel();
      try {
        await onSuccess(resp);
      } catch (callbackError) {
        console.error('onSuccess callback error:', callbackError);
      }
    } catch (err) {
      console.error('saveTransaction error:', err);
      setError(t('ui.error_saving_transaction'));
    } finally {
      setLoading(false);
    }
  };
  const clientPlaceholder = !companyId
    ? t('ui.first_select_a_company')
    : filteredClients.length === 0
      ? t('ui.no_clients_found_for_the_company')
      : t('ui.select_client');
  const categoryPlaceholder = !companyId
    ? t('ui.first_select_a_company')
    : categoriesLoading
      ? t('ui.loading_categories')
      : categories.length === 0
        ? t('ui.no_categories_found_for_the_company')
        : t('ui.select_category');
  const productPlaceholder = !companyId
    ? t('ui.first_select_a_company')
    : filteredProducts.length === 0
      ? t('ui.no_products_found_for_the_company')
      : t('ui.select_product');
  const servicePlaceholder = !companyId
    ? t('ui.first_select_a_company')
    : filteredServices.length === 0
      ? t('ui.no_services_found_for_the_company')
      : t('ui.select_a_service');
  const servicesLocked = Boolean(transaction && (transaction.services?.length ?? 0) > 0);
  const categoryOptions: OptionType<string>[] = categories.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));
  const handleDelete = async () => {
    if (!transaction || !transaction.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_delete_this_5'));
    if (!ok) return;
    setError(null);
    setDeleting(true);
    try {
      if (companyId) {
        await deleteCompanyTransaction(String(companyId), String(transaction.id));
      } else {
        await deleteTransaction(String(transaction.id));
      }
      await onSuccess(transaction);
    } catch (err: any) {
      console.error('TransactionForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_deleting_transaction');
      setError(String(msg));
    } finally {
      setDeleting(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className='space-y-4 max-h-[70vh] overflow-y-auto px-1 md:max-h-none md:overflow-visible'>
      {!isCompanyLocked && (
        <SelectOption
          label={t('ui.company')}
          placeholder={t('ui.select_a_company')}
          options={companyOptions}
          value={companyId}
          onChange={(v) => setCompanyId(v as string | undefined)}
        />
      )}

      <InputDefault
        label={t('ui.amount')}
        type='text'
        value={initialAmount}
        onChange={(e) =>
          setInitialAmount(
            maskDecimalInput(e.target.value, {
              maxFractionDigits: 2,
            })
          )
        }
        placeholder='0.00'
        inputMode='decimal'
        required
      />

      <div className='grid grid-cols-3 gap-3'>
        <SelectOption
          label={t('ui.type')}
          options={typeOptions}
          value={type}
          onChange={(v) => setType((v as 'income' | 'outcome') ?? 'income')}
        />

        <SelectOption
          label={t('ui.method')}
          options={methodOptions}
          value={method}
          onChange={(v) => setMethod((v as 'cash' | 'card') ?? 'cash')}
        />

        <SelectOption
          label={t('ui.currency')}
          options={currencyOptions}
          value={currency}
          onChange={(v) => setCurrency((v as 'UZS' | 'USD') ?? 'UZS')}
        />
      </div>

      <ToggleBadgeGroup
        storageKey={preferencesKeys.transactionExtra}
        items={[
          {
            id: 'client',
            label: t('ui.client_and_products_services'),
          },
          {
            id: 'details',
            label: t('ui.discount_and_details'),
          },
        ]}
      >
        {(openExtra) => (
          <>
            {openExtra === 'client' && (
              <div className='mt-3 space-y-3'>
                <SelectOption
                  label={
                    <>
                      {t('ui.client')}
                      <OptionalField />
                    </>
                  }
                  placeholder={clientPlaceholder}
                  options={clientOptions}
                  value={clientId}
                  onChange={(v) => setClientId(v as string | undefined)}
                  disabled={servicesLocked}
                />

                <SelectMultiple
                  label={
                    <>
                      {t('ui.categories')}
                      <OptionalField />
                    </>
                  }
                  placeholder={categoryPlaceholder}
                  options={categoryOptions}
                  value={categoryIds}
                  onChange={(vals) => setCategoryIds(vals as string[])}
                  disabled={!companyId || categoriesLoading}
                />

                <SelectMultiple
                  label={
                    <>
                      {t('ui.products_2')}
                      <OptionalField />
                    </>
                  }
                  placeholder={productPlaceholder}
                  options={productOptions}
                  value={productIds}
                  onChange={(vals) => {
                    const nextIds = (vals as string[]) ?? [];
                    const nextQuantities: Record<string, number> = {};
                    nextIds.forEach((id) => {
                      nextQuantities[id] = productQuantities[id] ?? 1;
                    });
                    setProductIds(nextIds);
                    setProductQuantities(nextQuantities);
                  }}
                  disabled={!companyId}
                />

                {productIds.length > 0 && (
                  <div className='space-y-2 rounded-lg border border-gray-200 bg-white/60 p-3'>
                    <div className='text-xs text-gray-500'>{t('ui.number_of_products')}</div>
                    {productIds.map((id) => {
                      const product = filteredProducts.find((p) => String(p.id) === String(id));
                      const label = product?.name ?? id;
                      return (
                        <div key={id} className='grid grid-cols-1 md:grid-cols-2 gap-3 items-end'>
                          <div className='text-sm text-gray-700'>{label}</div>
                          <InputDefault
                            type='number'
                            min={1}
                            step={1}
                            value={productQuantities[id] ?? 1}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              setProductQuantities((prev) => ({
                                ...prev,
                                [id]: Number.isFinite(next) && next > 0 ? Math.floor(next) : 1,
                              }));
                            }}
                            disabled={!companyId}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <SelectMultiple
                  label={
                    <>
                      {t('ui.services_3')}
                      <OptionalField />
                    </>
                  }
                  placeholder={servicePlaceholder}
                  options={serviceOptions}
                  value={serviceIds}
                  onChange={(vals) => {
                    const nextIds = (vals as string[]) ?? [];
                    const nextQuantities: Record<string, number> = {};
                    nextIds.forEach((id) => {
                      nextQuantities[id] = serviceQuantities[id] ?? 1;
                    });
                    setServiceIds(nextIds);
                    setServiceQuantities(nextQuantities);
                  }}
                  disabled={!companyId || servicesLocked}
                />

                {servicesLocked && (
                  <div className='text-xs text-gray-500'>{t('ui.services_have_already_been_scheduled_changing_the_list')}</div>
                )}

                {serviceIds.length > 0 && (
                  <div className='space-y-2 rounded-lg border border-gray-200 bg-white/60 p-3'>
                    <div className='text-xs text-gray-500'>{t('ui.number_of_services')}</div>
                    {serviceIds.map((id) => {
                      const svc = filteredServices.find((s) => String(s.id) === String(id));
                      const label = svc?.name ?? id;
                      return (
                        <div key={id} className='grid grid-cols-1 md:grid-cols-2 gap-3 items-end'>
                          <div className='text-sm text-gray-700'>{label}</div>
                          <InputDefault
                            type='number'
                            min={1}
                            step={1}
                            value={serviceQuantities[id] ?? 1}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              setServiceQuantities((prev) => ({
                                ...prev,
                                [id]: Number.isFinite(next) && next > 0 ? Math.floor(next) : 1,
                              }));
                            }}
                            disabled={servicesLocked}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {serviceIds.length > 0 && (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                    <InputDefault
                      label={t('ui.start_of_services_date')}
                      type='date'
                      value={servicesStartDate}
                      onChange={(e) => setServicesStartDate(e.target.value)}
                      disabled={servicesLocked}
                    />
                    <InputDefault
                      label={t('ui.start_of_services_time')}
                      type='time'
                      value={servicesStartTime}
                      onChange={(e) => setServicesStartTime(e.target.value)}
                      step={60}
                      disabled={servicesLocked}
                    />
                  </div>
                )}
              </div>
            )}

            {openExtra === 'details' && (
              <div className='mt-3 space-y-3'>
                <InputDefault
                  label={
                    <>
                      {t('ui.discount')}
                      <OptionalField />
                    </>
                  }
                  type='text'
                  value={discount}
                  onChange={(e) =>
                    setDiscount(
                      maskDecimalInput(e.target.value, {
                        maxFractionDigits: 2,
                      })
                    )
                  }
                  placeholder='0.00'
                  inputMode='decimal'
                />

                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <InputDefault label={t('ui.date')} type='date' value={date} onChange={(e) => setDate(e.target.value)} />
                  <InputDefault
                    label={t('ui.time')}
                    type='time'
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    step={60}
                  />
                </div>

                <TextAreaDefault
                  label={
                    <>
                      {t('ui.description')}
                      <OptionalField />
                    </>
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </ToggleBadgeGroup>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-between'>
        <div>
          {transaction && transaction.id && (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={loading || deleting}>
              {deleting ? t('ui.wait_2') : t('ui.delete')}
            </ButtonDefault>
          )}
        </div>

        <div className='flex gap-3'>
          <ButtonDefault type='button' variant='secondary' onClick={onCancel} disabled={loading || deleting}>
            {t('ui.cancel')}
          </ButtonDefault>
          <ButtonDefault type='submit' variant='positive' disabled={loading || deleting}>
            {loading ? t('ui.saving') : transaction ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
