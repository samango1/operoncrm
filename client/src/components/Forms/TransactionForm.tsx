'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import TextAreaDefault from '../Inputs/TextAreaDefault';
import SelectOption, { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import SelectMultiple from '@/components/Inputs/SelectMultiple';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import type { Company } from '@/types/api/companies';
import type { Transaction, TransactionCategory } from '@/types/api/transactions';
import type { Client } from '@/types/api/clients';
import { createTransaction, updateTransaction, getCompanyTransactionCategories } from '@/lib/api';

type Props = {
  companies: Company[];
  clients?: Client[];
  defaultCompanyId?: string;
  transaction?: Transaction;
  onCancel: () => void;
  onSuccess: (created?: Transaction) => void | Promise<void>;
};

export default function TransactionForm({
  companies,
  clients = [],
  defaultCompanyId,
  transaction,
  onCancel,
  onSuccess,
}: Props) {
  const initialCompanyId = defaultCompanyId ? String(defaultCompanyId) : undefined;
  const [companyId, setCompanyId] = useState<string | undefined>(initialCompanyId);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [initialAmount, setInitialAmount] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [type, setType] = useState<'income' | 'outcome'>('income');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCompanyLocked = Boolean(defaultCompanyId);

  const extractCategoryIds = (value?: Transaction['categories']): string[] => {
    if (!value) return [];
    return (value as Array<TransactionCategory | string>)
      .map((item) => (typeof item === 'string' ? item : String(item?.id ?? '')))
      .filter((id) => id);
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
    setInitialAmount(transaction.initial_amount ?? transaction.amount ?? '');
    setDiscount(transaction.discount_amount ?? 0);
    setType(transaction.type ?? 'income');
    setMethod(transaction.method ?? 'cash');
    setCurrency(transaction.currency ?? 'UZS');
    setDate((transaction.date ?? transaction.created_at ?? new Date().toISOString()).slice(0, 10));
    setDescription(transaction.description ?? '');
    setCategoryIds(extractCategoryIds(transaction.categories));
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

  const fetchCategories = async (company: string) => {
    setCategoriesLoading(true);
    try {
      const res = await getCompanyTransactionCategories(company, { page: 1, page_size: 1000 });
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
    if (!clientId) return;
    const exists = filteredClients.some((c) => String(c.id) === String(clientId));
    if (!exists) {
      setClientId(undefined);
    }
  }, [companyId, clients]);

  const typeOptions: OptionType<string>[] = [
    { value: 'income', label: 'Доход' },
    { value: 'outcome', label: 'Расход' },
  ];

  const methodOptions: OptionType<string>[] = [
    { value: 'cash', label: 'Нал' },
    { value: 'card', label: 'Карта' },
  ];

  const currencyOptions: OptionType<string>[] = [
    { value: 'UZS', label: 'UZS' },
    { value: 'USD', label: 'USD' },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!companyId) {
      setError('Выберите компанию');
      return;
    }
    if (initialAmount === '' || Number(initialAmount) <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    const payload: Partial<Transaction> = {
      initial_amount: Number(initialAmount),
      discount_amount: Number(discount) || 0,
      type,
      method,
      currency,
      date,
      description: description || undefined,
      company: companyId,
      client: clientId || undefined,
      categories: categoryIds,
    };

    try {
      setLoading(true);
      let resp: Transaction;
      if (transaction && transaction.id) {
        resp = await updateTransaction(String(transaction.id), payload);
      } else {
        resp = await createTransaction(payload);
      }
      onCancel();
      try {
        await onSuccess(resp);
      } catch (callbackError) {
        console.error('onSuccess callback error:', callbackError);
      }
    } catch (err) {
      console.error('saveTransaction error:', err);
      setError('Ошибка при сохранении транзакции');
    } finally {
      setLoading(false);
    }
  };

  const clientPlaceholder = !companyId
    ? 'Сначала выберите компанию'
    : filteredClients.length === 0
      ? 'Клиенты для компании не найдены'
      : 'Выберите клиента';

  const categoryPlaceholder = !companyId
    ? 'Сначала выберите компанию'
    : categoriesLoading
      ? 'Загрузка категорий...'
      : categories.length === 0
        ? 'Категории для компании не найдены'
        : 'Выберите категорию';

  const categoryOptions: OptionType<string>[] = categories.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {!isCompanyLocked && (
        <SelectOption
          label='Компания'
          placeholder='Выберите компанию'
          options={companyOptions}
          value={companyId}
          onChange={(v) => setCompanyId(v as string | undefined)}
        />
      )}

      <SelectOption
        label='Клиент (опционально)'
        placeholder={clientPlaceholder}
        options={clientOptions}
        value={clientId}
        onChange={(v) => setClientId(v as string | undefined)}
      />

      <SelectMultiple
        label='Категории (опционально)'
        placeholder={categoryPlaceholder}
        options={categoryOptions}
        value={categoryIds}
        onChange={(vals) => setCategoryIds(vals as string[])}
        disabled={!companyId || categoriesLoading}
      />

      <div className='flex gap-3'>
        <InputDefault
          label='Сумма'
          type='number'
          value={initialAmount}
          onChange={(e) => setInitialAmount(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder='0.00'
          min={0}
          required
        />

        <InputDefault
          label='Скидка'
          type='number'
          value={discount}
          onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder='0.00'
          min={0}
        />
      </div>
      <InputDefault label='Дата' type='date' value={date} onChange={(e) => setDate(e.target.value)} />

      <div className='grid grid-cols-3 gap-3'>
        <SelectOption
          label='Тип'
          options={typeOptions}
          value={type}
          onChange={(v) => setType((v as 'income' | 'outcome') ?? 'income')}
        />

        <SelectOption
          label='Метод'
          options={methodOptions}
          value={method}
          onChange={(v) => setMethod((v as 'cash' | 'card') ?? 'cash')}
        />

        <SelectOption
          label='Валюта'
          options={currencyOptions}
          value={currency}
          onChange={(v) => setCurrency((v as 'UZS' | 'USD') ?? 'UZS')}
        />
      </div>

      <div>
        <label className='mb-1 block text-md font-medium text-gray-700'>Описание</label>
        <TextAreaDefault value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-end gap-3'>
        <ButtonDefault type='button' variant='secondary' onClick={onCancel} disabled={loading}>
          Отмена
        </ButtonDefault>
        <ButtonDefault type='submit' variant='positive' disabled={loading}>
          {loading ? 'Сохранение...' : transaction ? 'Сохранить' : 'Создать'}
        </ButtonDefault>
      </div>
    </form>
  );
}
