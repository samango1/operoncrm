'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import TextAreaDefault from '@/components/Inputs/TextAreaDefault';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import type { Product, ProductCurrency, ProductUnit } from '@/types/api/products';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import {
  getCompanies,
  createProduct,
  updateProduct,
  deleteProduct,
  createCompanyProduct,
  updateCompanyProduct,
  deleteCompanyProduct,
} from '@/lib/api';

type Props = {
  product?: Product | null;
  onCancel: () => void;
  onSuccess: (product: Product) => void | Promise<void>;
  fixedCompanyId?: string;
  companiesOverride?: Company[];
};

const extractCompanyId = (company?: Company | string): string | undefined => {
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  return company.id ? String(company.id) : undefined;
};

export default function ProductForm({ product, onCancel, onSuccess, fixedCompanyId, companiesOverride }: Props) {
  const [name, setName] = useState<string>(product?.name ?? '');
  const [description, setDescription] = useState<string>(product?.description ?? '');
  const [price, setPrice] = useState<number | ''>(product?.price ?? '');
  const [currency, setCurrency] = useState<ProductCurrency>(product?.currency ?? 'UZS');
  const [active, setActive] = useState<boolean>(product?.active ?? true);
  const [stockQuantity, setStockQuantity] = useState<number | ''>(product?.stock_quantity ?? 0);
  const [stockMode, setStockMode] = useState<'unlimited' | 'out' | 'in'>('out');
  const [minStockLevel, setMinStockLevel] = useState<number | ''>(product?.min_stock_level ?? 1);
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? 'piece');
  const [costPrice, setCostPrice] = useState<number | ''>(product?.cost_price ?? '');
  const [weight, setWeight] = useState<number | ''>(product?.weight ?? '');
  const [volume, setVolume] = useState<number | ''>(product?.volume ?? '');
  const [companyId, setCompanyId] = useState<string | undefined>(fixedCompanyId ?? extractCompanyId(product?.company));

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    setName(product?.name ?? '');
    setDescription(product?.description ?? '');
    setPrice(product?.price ?? '');
    setCurrency(product?.currency ?? 'UZS');
    setActive(product?.active ?? true);
    setStockQuantity(product?.stock_quantity ?? 0);
    setMinStockLevel(product?.min_stock_level ?? 1);
    setUnit(product?.unit ?? 'piece');
    setCostPrice(product?.cost_price ?? '');
    setWeight(product?.weight ?? '');
    setVolume(product?.volume ?? '');
    setCompanyId(fixedCompanyId ?? extractCompanyId(product?.company));
  }, [product, fixedCompanyId]);

  useEffect(() => {
    if (stockQuantity === -1) {
      setStockMode('unlimited');
      return;
    }
    if (Number(stockQuantity) <= 0 || stockQuantity === '') {
      setStockMode('out');
      return;
    }
    setStockMode('in');
  }, [stockQuantity]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (companiesOverride) {
        setCompanies(companiesOverride);
        setLoadingCompanies(false);
        return;
      }
      if (fixedCompanyId) {
        setCompanies([]);
        setLoadingCompanies(false);
        return;
      }
      setLoadingCompanies(true);
      try {
        const res = await getCompanies({ page: 1, page_size: 1000 });
        if (!mounted) return;
        setCompanies(res.results ?? res);
      } catch (e) {
        console.error('getCompanies error (ProductForm):', e);
      } finally {
        if (mounted) setLoadingCompanies(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [companiesOverride, fixedCompanyId]);

  const companyOptions: OptionType<string>[] = companies.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));

  const currencyOptions: OptionType<ProductCurrency>[] = [
    { value: 'UZS', label: 'UZS' },
    { value: 'USD', label: 'USD' },
  ];

  const unitOptions: OptionType<ProductUnit>[] = [
    { value: 'kilogram', label: 'Килограмм' },
    { value: 'piece', label: 'Штука' },
    { value: 'meter', label: 'Метр' },
    { value: 'liter', label: 'Литр' },
  ];

  const stockModeOptions: OptionType<'unlimited' | 'out' | 'in'>[] = [
    { value: 'unlimited', label: 'Неограничен' },
    { value: 'out', label: 'Закончился' },
    { value: 'in', label: 'Есть в наличии' },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setCompanyError(null);

    if (!name.trim()) {
      setError('Название обязательно');
      return;
    }

    if (!description.trim()) {
      setError('Описание обязательно');
      return;
    }

    if (!fixedCompanyId && !companyId) {
      setCompanyError('Компания обязательна');
      return;
    }

    if (price === '' || Number(price) <= 0) {
      setError('Цена должна быть больше 0');
      return;
    }

    if (stockMode === 'in' && (stockQuantity === '' || Number(stockQuantity) < 1)) {
      setError('Остаток должен быть больше 0');
      return;
    }
    if (stockMode !== 'in' && stockQuantity === '' && stockMode !== 'out') {
      setError('Остаток должен быть -1 или больше');
      return;
    }

    if (minStockLevel === '' || Number(minStockLevel) <= 0) {
      setError('Минимальный остаток должен быть больше 0');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Product> = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        currency,
        active,
        stock_quantity: stockMode === 'unlimited' ? -1 : stockMode === 'out' ? 0 : Number(stockQuantity),
        min_stock_level: Number(minStockLevel),
        unit,
        cost_price: costPrice === '' ? undefined : Number(costPrice),
        weight: weight === '' ? undefined : Number(weight),
        volume: volume === '' ? undefined : Number(volume),
        company: companyId ?? undefined,
      };

      let resp: Product;
      if (fixedCompanyId) {
        if (product && product.id) {
          resp = await updateCompanyProduct(String(fixedCompanyId), String(product.id), payload);
        } else {
          resp = await createCompanyProduct(String(fixedCompanyId), payload);
        }
      } else if (product && product.id) {
        resp = await updateProduct(String(product.id), payload);
      } else {
        resp = await createProduct(payload);
      }

      await onSuccess(resp);
    } catch (err: any) {
      console.error('save product error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось сохранить продукт';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !product.id) return;
    const ok = window.confirm('Вы уверены, что хотите удалить этот продукт? Это действие невозможно отменить.');
    if (!ok) return;

    setError(null);
    setSaving(true);
    try {
      if (fixedCompanyId) {
        await deleteCompanyProduct(String(fixedCompanyId), String(product.id));
      } else {
        await deleteProduct(String(product.id));
      }
      if (onSuccess) {
        onSuccess(product);
      }
    } catch (err: any) {
      console.error('ProductForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка при удалении продукта';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='space-y-3 md:space-y-4 max-h-[70vh] overflow-y-auto px-1 md:max-h-none md:overflow-visible'
    >
      <InputDefault value={name} label='Название' onChange={(e) => setName(e.target.value)} required />

      <div>
        <TextAreaDefault label='Описание' value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3'>
        <InputDefault
          label='Цена'
          type='number'
          value={price}
          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
          min={1}
          required
        />

        <SelectOption
          label='Валюта'
          options={currencyOptions}
          value={currency}
          onChange={(v) => setCurrency((v as ProductCurrency) ?? 'UZS')}
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3'>
        <SelectOption
          label='Остаток'
          options={stockModeOptions}
          value={stockMode}
          onChange={(v) => {
            const next = (v as typeof stockMode) ?? 'out';
            setStockMode(next);
            if (next === 'unlimited') setStockQuantity(-1);
            if (next === 'out') setStockQuantity(0);
            if (next === 'in' && (stockQuantity === -1 || stockQuantity === 0 || stockQuantity === '')) {
              setStockQuantity(1);
            }
          }}
        />
        <InputDefault
          label='Минимальный остаток'
          type='number'
          value={minStockLevel}
          onChange={(e) => setMinStockLevel(e.target.value === '' ? '' : Number(e.target.value))}
          min={1}
          required
        />
      </div>

      {stockMode === 'in' && (
        <InputDefault
          label='Количество в наличии'
          type='number'
          value={stockQuantity}
          onChange={(e) => setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          min={1}
          required
        />
      )}

      <div className='grid grid-cols-1 gap-2 md:gap-3'>
        <SelectOption label='Ед. измерения' options={unitOptions} value={unit} onChange={(v) => setUnit(v as ProductUnit)} />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3'>
        <InputDefault
          label='Себестоимость'
          type='number'
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
          min={1}
        />
        <InputDefault
          label='Вес, кг'
          type='number'
          value={weight}
          onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
          min={0}
        />
        <InputDefault
          label='Объем, м³'
          type='number'
          value={volume}
          onChange={(e) => setVolume(e.target.value === '' ? '' : Number(e.target.value))}
          min={0}
        />
      </div>
      <div className='flex items-end'>
        <ToggleSwitch checked={active} onChange={setActive} onLabel='Доступен' offLabel='Недоступен' />
      </div>
      {!fixedCompanyId && (
        <SelectOption
          label='Компания'
          placeholder={loadingCompanies ? 'Загрузка...' : 'Выберите компанию'}
          options={companyOptions}
          value={companyId}
          onChange={(v) => setCompanyId(v as string | undefined)}
          disabled={loadingCompanies || companyOptions.length === 0}
          error={companyError ?? undefined}
        />
      )}

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-between'>
        <div>
          {product && product.id && (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={saving}>
              {saving ? 'Подождите...' : 'Удалить'}
            </ButtonDefault>
          )}
        </div>

        <div className='flex gap-3'>
          <ButtonDefault type='button' onClick={onCancel} variant='secondary' disabled={saving}>
            Отмена
          </ButtonDefault>
          <ButtonDefault type='submit' variant='positive' disabled={saving}>
            {saving ? 'Сохранение...' : product ? 'Сохранить' : 'Создать'}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
