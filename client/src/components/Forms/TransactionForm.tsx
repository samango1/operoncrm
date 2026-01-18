'use client';

import React, { useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption, { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import type { Company } from '@/types/api/companies';
import type { Transaction } from '@/types/api/transactions';
import { createTransaction } from '@/lib/api';

type Props = {
  companies: Company[];
  defaultCompanyId?: string;
  onCancel: () => void;
  onSuccess: (created?: Transaction) => void | Promise<void>;
};

export default function TransactionForm({ companies, defaultCompanyId, onCancel, onSuccess }: Props) {
  const [companyId, setCompanyId] = useState<string | undefined>(defaultCompanyId ? String(defaultCompanyId) : undefined);
  const [initialAmount, setInitialAmount] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [type, setType] = useState<'income' | 'outcome'>('income');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyOptions: OptionType<string>[] = companies.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));

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
    };

    try {
      setLoading(true);
      const created = await createTransaction(payload);
      await onSuccess(created);
      onCancel();
    } catch (err) {
      console.error('createTransaction error:', err);
      setError('Ошибка при создании транзакции');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <SelectOption
        label='Компания'
        placeholder='Выберите компанию'
        options={companyOptions}
        value={companyId}
        onChange={(v) => setCompanyId(v as string | undefined)}
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
        <textarea
          className='w-full border rounded-md p-2'
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-end gap-3'>
        <ButtonDefault type='button' variant='ghost' onClick={onCancel} disabled={loading}>
          Отмена
        </ButtonDefault>
        <ButtonDefault type='submit' variant='positive' disabled={loading}>
          {loading ? 'Сохранение...' : 'Создать'}
        </ButtonDefault>
      </div>
    </form>
  );
}
