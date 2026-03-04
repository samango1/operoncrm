'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import type { TransactionCategory } from '@/types/api/transactions';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import {
  getCompanies,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
  createCompanyTransactionCategory,
  updateCompanyTransactionCategory,
  deleteCompanyTransactionCategory,
} from '@/lib/api';
import { t } from '@/i18n';
type Props = {
  category?: TransactionCategory | null;
  onCancel: () => void;
  onSuccess: (category: TransactionCategory) => void | Promise<void>;
  fixedCompanyId?: string;
  companiesOverride?: Company[];
};
const extractCompanyId = (company?: Company | string): string | undefined => {
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  return company.id ? String(company.id) : undefined;
};
export default function TransactionCategoryForm({ category, onCancel, onSuccess, fixedCompanyId, companiesOverride }: Props) {
  const [name, setName] = useState<string>(category?.name ?? '');
  const [companyId, setCompanyId] = useState<string | undefined>(fixedCompanyId ?? extractCompanyId(category?.company));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  useEffect(() => {
    setName(category?.name ?? '');
    setCompanyId(fixedCompanyId ?? extractCompanyId(category?.company));
  }, [category, fixedCompanyId]);
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
        console.error('getCompanies error (TransactionCategoryForm):', e);
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
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setCompanyError(null);
    if (!name.trim()) {
      setError(t('ui.title_required'));
      return;
    }
    if (!fixedCompanyId && !companyId) {
      setCompanyError(t('ui.company_is_required'));
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<TransactionCategory> = {
        name: name.trim(),
        company: companyId ?? undefined,
      };
      let resp: TransactionCategory;
      if (fixedCompanyId) {
        if (category && category.id) {
          resp = await updateCompanyTransactionCategory(String(fixedCompanyId), String(category.id), payload);
        } else {
          resp = await createCompanyTransactionCategory(String(fixedCompanyId), payload);
        }
      } else if (category && category.id) {
        resp = await updateTransactionCategory(String(category.id), payload);
      } else {
        resp = await createTransactionCategory(payload);
      }
      await onSuccess(resp);
    } catch (err: any) {
      console.error('save transaction category error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.failed_to_save_category');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!category || !category.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_delete_this_3'));
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      if (fixedCompanyId) {
        await deleteCompanyTransactionCategory(String(fixedCompanyId), String(category.id));
      } else {
        await deleteTransactionCategory(String(category.id));
      }
      if (onSuccess) {
        onSuccess(category);
      }
    } catch (err: any) {
      console.error('TransactionCategoryForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_when_deleting_a_category');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <InputDefault value={name} label={t('ui.title')} onChange={(e) => setName(e.target.value)} required />

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
          {category && category.id && (
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
            {saving ? t('ui.saving') : category ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
