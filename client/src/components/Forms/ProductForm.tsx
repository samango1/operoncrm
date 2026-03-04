'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import TextAreaDefault from '@/components/Inputs/TextAreaDefault';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import OptionalField from '@/components/Inputs/OptionalField';
import OptionalSection from '@/components/Containers/OptionalSection';
import { preferenceIds } from '@/lib/preferencesCookies';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import type { Product, ProductCurrency, ProductUnit } from '@/types/api/products';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import { compareDecimalStrings, isValidDecimal, maskDecimalInput, normalizeDecimalInput, toDecimalString } from '@/lib/decimal';
import {
  getCompanies,
  createProduct,
  updateProduct,
  deleteProduct,
  createCompanyProduct,
  updateCompanyProduct,
  deleteCompanyProduct,
} from '@/lib/api';
import { t } from '@/i18n';
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
  const [price, setPrice] = useState<string>(toDecimalString(product?.price ?? ''));
  const [currency, setCurrency] = useState<ProductCurrency>(product?.currency ?? 'UZS');
  const [active, setActive] = useState<boolean>(product?.active ?? true);
  const [stockQuantity, setStockQuantity] = useState<number | ''>(product?.stock_quantity ?? 0);
  const [stockMode, setStockMode] = useState<'unlimited' | 'out' | 'in'>('out');
  const [minStockLevel, setMinStockLevel] = useState<number | ''>(product?.min_stock_level ?? 1);
  const [unit, setUnit] = useState<ProductUnit>(product?.unit ?? 'piece');
  const [costPrice, setCostPrice] = useState<string>(toDecimalString(product?.cost_price ?? ''));
  const [weight, setWeight] = useState<string>(toDecimalString(product?.weight ?? ''));
  const [volume, setVolume] = useState<string>(toDecimalString(product?.volume ?? ''));
  const [companyId, setCompanyId] = useState<string | undefined>(fixedCompanyId ?? extractCompanyId(product?.company));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const deriveStockMode = (value: number | ''): 'unlimited' | 'out' | 'in' => {
    if (value === -1) return 'unlimited';
    if (value === '' || Number(value) <= 0) return 'out';
    return 'in';
  };
  useEffect(() => {
    const nextStockQuantity = product?.stock_quantity ?? 0;
    setName(product?.name ?? '');
    setDescription(product?.description ?? '');
    setPrice(toDecimalString(product?.price ?? ''));
    setCurrency(product?.currency ?? 'UZS');
    setActive(product?.active ?? true);
    setStockQuantity(nextStockQuantity);
    setStockMode(deriveStockMode(nextStockQuantity));
    setMinStockLevel(product?.min_stock_level ?? 1);
    setUnit(product?.unit ?? 'piece');
    setCostPrice(toDecimalString(product?.cost_price ?? ''));
    setWeight(toDecimalString(product?.weight ?? ''));
    setVolume(toDecimalString(product?.volume ?? ''));
    setCompanyId(fixedCompanyId ?? extractCompanyId(product?.company));
  }, [product, fixedCompanyId]);
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
        const res = await getCompanies({
          page: 1,
          page_size: 1000,
        });
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
    {
      value: 'UZS',
      label: 'UZS',
    },
    {
      value: 'USD',
      label: 'USD',
    },
  ];
  const unitOptions: OptionType<ProductUnit>[] = [
    {
      value: 'kilogram',
      label: t('ui.kilogram'),
    },
    {
      value: 'piece',
      label: t('ui.piece'),
    },
    {
      value: 'meter',
      label: t('ui.meter'),
    },
    {
      value: 'liter',
      label: t('ui.liter'),
    },
  ];
  const stockModeOptions: OptionType<'unlimited' | 'out' | 'in'>[] = [
    {
      value: 'unlimited',
      label: t('ui.unlimited'),
    },
    {
      value: 'out',
      label: t('ui.ended'),
    },
    {
      value: 'in',
      label: t('ui.in_stock_2'),
    },
  ];
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setCompanyError(null);
    if (!name.trim()) {
      setError(t('ui.title_required'));
      return;
    }
    if (!description.trim()) {
      setError(t('ui.description_required'));
      return;
    }
    if (!fixedCompanyId && !companyId) {
      setCompanyError(t('ui.company_is_required'));
      return;
    }
    const normalizedPrice = normalizeDecimalInput(price);
    if (
      !isValidDecimal(normalizedPrice, {
        maxFractionDigits: 2,
      }) ||
      compareDecimalStrings(normalizedPrice, '0') <= 0
    ) {
      setError(t('ui.price_must_be_greater_than_0'));
      return;
    }
    if (stockMode === 'in' && (stockQuantity === '' || Number(stockQuantity) < 1)) {
      setError(t('ui.the_remainder_must_be_greater_than_0'));
      return;
    }
    if (stockMode !== 'in' && stockQuantity === '' && stockMode !== 'out') {
      setError(t('ui.the_remainder_must_be_1_or_greater'));
      return;
    }
    if (minStockLevel === '' || Number(minStockLevel) <= 0) {
      setError(t('ui.the_minimum_balance_must_be_greater_than_0'));
      return;
    }
    const normalizedCostPrice = costPrice === '' ? '' : normalizeDecimalInput(costPrice);
    if (
      costPrice !== '' &&
      (!isValidDecimal(normalizedCostPrice, {
        maxFractionDigits: 2,
      }) ||
        compareDecimalStrings(normalizedCostPrice, '0') <= 0)
    ) {
      setError(t('ui.cost_must_be_greater_than_0'));
      return;
    }
    const normalizedWeight = weight === '' ? '' : normalizeDecimalInput(weight);
    if (
      weight !== '' &&
      (!isValidDecimal(normalizedWeight, {
        maxFractionDigits: 3,
      }) ||
        compareDecimalStrings(normalizedWeight, '0') < 0)
    ) {
      setError(t('ui.weight_must_be_0_or_more'));
      return;
    }
    const normalizedVolume = volume === '' ? '' : normalizeDecimalInput(volume);
    if (
      volume !== '' &&
      (!isValidDecimal(normalizedVolume, {
        maxFractionDigits: 3,
      }) ||
        compareDecimalStrings(normalizedVolume, '0') < 0)
    ) {
      setError(t('ui.volume_must_be_0_or_greater'));
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Product> = {
        name: name.trim(),
        description: description.trim(),
        price: normalizedPrice,
        currency,
        active,
        stock_quantity: stockMode === 'unlimited' ? -1 : stockMode === 'out' ? 0 : Number(stockQuantity),
        min_stock_level: Number(minStockLevel),
        unit,
        cost_price: normalizedCostPrice === '' ? undefined : normalizedCostPrice,
        weight: normalizedWeight === '' ? undefined : normalizedWeight,
        volume: normalizedVolume === '' ? undefined : normalizedVolume,
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
      const msg = err?.response?.data?.detail || err?.message || t('ui.failed_to_save_product');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!product || !product.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_remove_this'));
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
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_uninstalling_product');
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
      <InputDefault value={name} label={t('ui.title')} onChange={(e) => setName(e.target.value)} required />

      <div>
        <TextAreaDefault label={t('ui.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3'>
        <InputDefault
          label={t('ui.price')}
          type='text'
          value={price}
          onChange={(e) =>
            setPrice(
              maskDecimalInput(e.target.value, {
                maxFractionDigits: 2,
              })
            )
          }
          inputMode='decimal'
          required
        />

        <SelectOption
          label={t('ui.currency')}
          options={currencyOptions}
          value={currency}
          onChange={(v) => setCurrency((v as ProductCurrency) ?? 'UZS')}
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3'>
        <SelectOption
          label={t('ui.remainder')}
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
          label={t('ui.minimum_balance')}
          type='number'
          value={minStockLevel}
          onChange={(e) => setMinStockLevel(e.target.value === '' ? '' : Number(e.target.value))}
          min={1}
          required
        />
      </div>

      {stockMode === 'in' && (
        <InputDefault
          label={t('ui.quantity_in_stock')}
          type='number'
          value={stockQuantity}
          onChange={(e) => setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={() => {
            if (stockQuantity === '' || Number(stockQuantity) <= 0) {
              setStockQuantity(0);
              setStockMode('out');
            }
          }}
          min={1}
          required
        />
      )}

      <div className='grid grid-cols-1 gap-2 md:gap-3'>
        <SelectOption
          label={t('ui.unit_of_measure')}
          options={unitOptions}
          value={unit}
          onChange={(v) => setUnit(v as ProductUnit)}
        />
      </div>

      <OptionalSection preferenceId={preferenceIds.optionalSection.productFormExtra}>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3'>
          <InputDefault
            label={
              <>
                {t('ui.cost')}
                <OptionalField />
              </>
            }
            type='text'
            value={costPrice}
            onChange={(e) =>
              setCostPrice(
                maskDecimalInput(e.target.value, {
                  maxFractionDigits: 2,
                })
              )
            }
            inputMode='decimal'
          />
          <InputDefault
            label={
              <>
                {t('ui.weight_kg')}
                <OptionalField />
              </>
            }
            type='text'
            value={weight}
            onChange={(e) =>
              setWeight(
                maskDecimalInput(e.target.value, {
                  maxFractionDigits: 3,
                })
              )
            }
            inputMode='decimal'
          />
          <InputDefault
            label={
              <>
                {t('ui.volume_m')}
                <OptionalField />
              </>
            }
            type='text'
            value={volume}
            onChange={(e) =>
              setVolume(
                maskDecimalInput(e.target.value, {
                  maxFractionDigits: 3,
                })
              )
            }
            inputMode='decimal'
          />
        </div>
      </OptionalSection>
      <div className='flex items-end'>
        <ToggleSwitch checked={active} onChange={setActive} onLabel={t('ui.available')} offLabel={t('ui.not_available')} />
      </div>
      {!fixedCompanyId && (
        <SelectOption
          label={t('ui.company')}
          placeholder={loadingCompanies ? t('ui.loading') : t('ui.select_a_company')}
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
              {saving ? t('ui.wait_2') : t('ui.delete')}
            </ButtonDefault>
          )}
        </div>

        <div className='flex gap-3'>
          <ButtonDefault type='button' onClick={onCancel} variant='secondary' disabled={saving}>
            {t('ui.cancel')}
          </ButtonDefault>
          <ButtonDefault type='submit' variant='positive' disabled={saving}>
            {saving ? t('ui.saving') : product ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
