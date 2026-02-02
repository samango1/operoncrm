'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Company } from '@/types/api/companies';
import type { Product } from '@/types/api/products';
import type { Transaction, TransactionMethod, TransactionCurrency } from '@/types/api/transactions';
import { createCompanyTransaction, getCompanies, getCompanyBySlug, getCompanyProducts } from '@/lib/api';
import { buildTashkentDateTime, getTashkentNowParts } from '@/lib/datetime';
import { compareDecimalStrings, formatMoney, isValidDecimal, maskDecimalInput, normalizeDecimalInput } from '@/lib/decimal';

import SelectOption from '@/components/Inputs/SelectOption';
import SearchInput from '@/components/Inputs/SearchInput';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import Pagination from '@/components/Layouts/Pagination';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import InputDefault from '@/components/Inputs/InputDefault';
import TextAreaDefault from '@/components/Inputs/TextAreaDefault';
import PosProductCard from '@/components/Cards/ProductCard';
import ConfirmModalWindow from '@/components/ModalWindows/ConfirmModalWindow';
import { Funnel } from 'lucide-react';

const panelClasses = 'rounded-2xl border border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-sm';

type PosPageProps = {
  tenantSlug?: string;
};

type CurrencyState = {
  currency?: TransactionCurrency;
  mixed: boolean;
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

const isInStock = (qty?: number) => {
  if (qty === undefined || qty === null) return true;
  if (Number(qty) === -1) return true;
  return Number(qty) > 0;
};

const resolveCompanyLabel = (company?: Company | null, fallbackId?: string) => {
  if (!company) return fallbackId ? `Компания ${fallbackId}` : 'Компания не выбрана';
  return company.name || company.slug || fallbackId || 'Компания';
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
  return Boolean(target.closest('input, textarea, select, [contenteditable=\"true\"]'));
};

export default function PosPage({ tenantSlug }: PosPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [activeOnly, setActiveOnly] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<TransactionMethod>('cash');
  const [note, setNote] = useState('');
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
        setCompany(res as Company);
        setCompanyId(res?.id ? String(res.id) : undefined);
      } catch (err) {
        console.error('getCompanyBySlug error:', err);
        setCompany(null);
        setCompanyId(undefined);
        setCompanyError('Не удалось определить компанию');
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchCompany();
  }, [tenantSlug]);

  useEffect(() => {
    setSelectedProducts([]);
    setDiscount('');
    setNote('');
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [companyId]);

  const fetchProducts = async (id: string, page = currentPage, ps = pageSize, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyProducts(id, { page, page_size: ps, search: q });
      setProducts(res.results as Product[]);
      setProductsCount(res.count ?? 0);
    } catch (err) {
      console.error('getCompanyProducts error:', err);
      setError('Не удалось загрузить продукты');
      setProducts([]);
      setProductsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setProductsCount(0);
      return;
    }
    fetchProducts(companyId, currentPage, pageSize, search);
  }, [companyId, currentPage, pageSize, search]);

  const selectedCompany = useMemo(() => {
    if (isTenantMode) return company;
    if (!companyId) return undefined;
    return companies.find((item) => String(item.id) === String(companyId));
  }, [companyId, companies, company, isTenantMode]);

  const companyOptions = useMemo(
    () =>
      companies.map((item) => ({
        value: String(item.id),
        label: item.name || item.slug || String(item.id),
      })),
    [companies]
  );

  const selectedProductIds = useMemo(() => new Set(selectedProducts.map((p) => String(p.id))), [selectedProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (activeOnly && !product.active) return false;
      if (inStockOnly && !isInStock(product.stock_quantity)) return false;
      return true;
    });
  }, [products, activeOnly, inStockOnly]);

  const currencyState: CurrencyState = useMemo(() => {
    const currencies = new Set(selectedProducts.map((p) => p.currency).filter(Boolean));
    if (currencies.size > 1) return { mixed: true };
    if (currencies.size === 1) return { mixed: false, currency: Array.from(currencies)[0] };
    return { mixed: false };
  }, [selectedProducts]);

  const displayCurrency = useMemo(() => {
    return currencyState.currency || products[0]?.currency || 'UZS';
  }, [currencyState.currency, products]);

  const subtotalValue = useMemo(() => {
    return selectedProducts.reduce((sum, product) => sum + parseAmount(product.price), 0);
  }, [selectedProducts]);

  const subtotalRaw = useMemo(() => toAmountString(subtotalValue), [subtotalValue]);

  const discountError = useMemo(() => buildDiscountError(discount, subtotalRaw), [discount, subtotalRaw]);

  const discountValue = useMemo(() => {
    if (discountError) return 0;
    return parseAmount(normalizeDecimalInput(discount || '0'));
  }, [discount, discountError]);

  const totalValue = useMemo(() => Math.max(0, subtotalValue - discountValue), [subtotalValue, discountValue]);
  const confirmDescription = useMemo(() => {
    if (selectedProducts.length === 0) return null;
    return (
      <div className='space-y-1'>
        <div>Позиций: {selectedProducts.length}</div>
        <div>
          Сумма: {formatMoney(toAmountString(totalValue))} {displayCurrency}
        </div>
      </div>
    );
  }, [selectedProducts.length, totalValue, displayCurrency]);

  const handleToggleProduct = (product: Product) => {
    const id = String(product.id);
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => String(p.id) === id);
      if (exists) return prev.filter((p) => String(p.id) !== id);
      return [...prev, product];
    });
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => String(p.id) !== String(productId)));
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleClear = () => {
    setSelectedProducts([]);
    setDiscount('');
    setNote('');
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSearch = (query: string) => {
    setSearch(query);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    } else {
      setCurrentPage(page);
    }
  };

  const methodOptions = useMemo(
    () => [
      { value: 'cash', label: 'Наличные' },
      { value: 'card', label: 'Карта' },
    ],
    []
  );

  const handleCheckout = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!companyId) {
      setSubmitError('Выберите компанию');
      return;
    }

    if (selectedProducts.length === 0) {
      setSubmitError('Выберите продукты для продажи');
      return;
    }

    if (currencyState.mixed || !currencyState.currency) {
      setSubmitError('Нельзя создать продажу с разными валютами');
      return;
    }

    const normalizedSubtotal = normalizeDecimalInput(subtotalRaw);
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

    const payload: Partial<Transaction> = {
      initial_amount: normalizedSubtotal,
      discount_amount: normalizedDiscount,
      type: 'income',
      method,
      currency: currencyState.currency,
      date: dateTimeValue,
      description: note || undefined,
      products: selectedProducts.map((product) => String(product.id)),
      company: companyId,
    };

    setSubmitting(true);
    try {
      await createCompanyTransaction(String(companyId), payload);
      setSubmitSuccess('Продажа успешно создана');
      setSelectedProducts([]);
      setDiscount('');
      setNote('');
      await fetchProducts(companyId, currentPage, pageSize, search);
    } catch (err) {
      console.error('createCompanyTransaction error:', err);
      setSubmitError('Не удалось создать продажу');
    } finally {
      setSubmitting(false);
    }
  };

  const selectionHint = useMemo(() => {
    if (!companyId) return 'Сначала выберите компанию, чтобы начать продажу';
    if (loading) return 'Загрузка каталога...';
    if (products.length === 0) return 'Нет доступных продуктов для этой компании';
    return '';
  }, [companyId, loading, products.length]);

  const checkoutDisabled = submitting || !companyId || selectedProducts.length === 0 || currencyState.mixed;

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

  return (
    <div className='space-y-6'>
      <section className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Продажа продукции</h1>
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
                {companyId ? `Показано ${filteredProducts.length} из ${productsCount}` : 'Компания не выбрана'}
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
                    offLabel='Все продукты'
                  />
                  <ToggleSwitch
                    checked={inStockOnly}
                    onChange={setInStockOnly}
                    label='Остаток'
                    onLabel='В наличии'
                    offLabel='Все остатки'
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
              Загрузка продуктов...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className='rounded-2xl border border-dashed border-gray-200 bg-white/60 p-6 text-gray-500'>
              {search ? 'Нет продуктов, подходящих под запрос' : 'Нет доступных продуктов'}
            </div>
          ) : (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {filteredProducts.map((product) => {
                const disabled = !product.active || !isInStock(product.stock_quantity);
                return (
                  <PosProductCard
                    key={String(product.id)}
                    product={product}
                    selected={selectedProductIds.has(String(product.id))}
                    disabled={disabled}
                    onToggle={handleToggleProduct}
                  />
                );
              })}
            </div>
          )}

          {companyId && productsCount > 0 && (
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              total={productsCount}
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
                <span className='text-xs text-gray-500'>{selectedProducts.length} поз.</span>
                <ButtonDefault
                  type='button'
                  variant='outline'
                  className='px-2 py-1 text-xs'
                  onClick={handleClear}
                  disabled={selectedProducts.length === 0}
                >
                  Очистить
                </ButtonDefault>
              </div>
            </div>

            <div className='mt-4 space-y-3'>
              {selectedProducts.length === 0 ? (
                <div className='rounded-xl border border-dashed border-gray-200 bg-white/70 p-4 text-sm text-gray-500'>
                  Выберите товары слева, чтобы сформировать чек
                </div>
              ) : (
                <div className='space-y-2 max-h-35 overflow-y-auto pr-1'>
                  {selectedProducts.map((product) => (
                    <div
                      key={String(product.id)}
                      className='flex items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2'
                    >
                      <div>
                        <div className='text-sm font-medium text-gray-900'>{product.name}</div>
                        <div className='text-xs text-gray-500'>
                          {formatMoney(product.price)} {product.currency}
                        </div>
                      </div>
                      <ButtonDefault
                        variant='outline'
                        className='px-2 py-1 text-xs'
                        onClick={() => handleRemoveProduct(String(product.id))}
                      >
                        ×
                      </ButtonDefault>
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
                  В чеке смешаны товары с разной валютой. Уберите товары в другой валюте.
                </div>
              )}
            </div>
          </div>

          <form className={panelClasses + ' p-4 space-y-4'} onSubmit={handleCheckoutSubmit}>
            <h3 className='text-base font-semibold'>Оплата</h3>

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
