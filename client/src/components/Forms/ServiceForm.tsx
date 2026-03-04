'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import TextAreaDefault from '@/components/Inputs/TextAreaDefault';
import ToggleSwitch from '@/components/Inputs/ToggleSwitch';
import OptionalField from '@/components/Inputs/OptionalField';
import OptionalSection from '@/components/Containers/OptionalSection';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import { preferenceIds } from '@/lib/preferencesCookies';
import type { Service, ServiceCurrency } from '@/types/api/services';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import { compareDecimalStrings, isValidDecimal, maskDecimalInput, normalizeDecimalInput, toDecimalString } from '@/lib/decimal';
import {
  getCompanies,
  createService,
  updateService,
  deleteService,
  createCompanyService,
  updateCompanyService,
  deleteCompanyService,
} from '@/lib/api';
import { t } from '@/i18n';
type Props = {
  service?: Service | null;
  onCancel: () => void;
  onSuccess: (service: Service) => void | Promise<void>;
  fixedCompanyId?: string;
  companiesOverride?: Company[];
};
const extractCompanyId = (company?: Company | string): string | undefined => {
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  return company.id ? String(company.id) : undefined;
};
const deriveDurationMode = (duration?: number | null): 'one-time' | 'minutes' => {
  if (duration === -1) return 'one-time';
  return 'minutes';
};
type DurationUnit = 'minutes' | 'hours' | 'days' | 'months' | 'years';
const UNIT_TO_MINUTES: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  months: 60 * 24 * 30,
  years: 60 * 24 * 365,
};
const inferDurationUnit = (
  duration?: number | null
): {
  value: number;
  unit: DurationUnit;
} => {
  if (!duration || duration <= 0)
    return {
      value: 60,
      unit: 'minutes',
    };
  const candidates: DurationUnit[] = ['years', 'months', 'days', 'hours', 'minutes'];
  for (const unit of candidates) {
    const unitMinutes = UNIT_TO_MINUTES[unit];
    if (duration % unitMinutes === 0) {
      return {
        value: duration / unitMinutes,
        unit,
      };
    }
  }
  return {
    value: duration,
    unit: 'minutes',
  };
};
export default function ServiceForm({ service, onCancel, onSuccess, fixedCompanyId, companiesOverride }: Props) {
  const [name, setName] = useState<string>(service?.name ?? '');
  const [description, setDescription] = useState<string>(service?.description ?? '');
  const [price, setPrice] = useState<string>(toDecimalString(service?.price ?? ''));
  const [currency, setCurrency] = useState<ServiceCurrency>(service?.currency ?? 'UZS');
  const [active, setActive] = useState<boolean>(service?.active ?? true);
  const [durationMode, setDurationMode] = useState<'one-time' | 'minutes'>(deriveDurationMode(service?.duration_minutes));
  const initialDuration = inferDurationUnit(service?.duration_minutes);
  const [durationValue, setDurationValue] = useState<number | ''>(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [costPrice, setCostPrice] = useState<string>(toDecimalString(service?.cost_price ?? ''));
  const [companyId, setCompanyId] = useState<string | undefined>(fixedCompanyId ?? extractCompanyId(service?.company));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  useEffect(() => {
    setName(service?.name ?? '');
    setDescription(service?.description ?? '');
    setPrice(toDecimalString(service?.price ?? ''));
    setCurrency(service?.currency ?? 'UZS');
    setActive(service?.active ?? true);
    setDurationMode(deriveDurationMode(service?.duration_minutes));
    const nextDuration = inferDurationUnit(service?.duration_minutes);
    setDurationValue(nextDuration.value);
    setDurationUnit(nextDuration.unit);
    setCostPrice(toDecimalString(service?.cost_price ?? ''));
    setCompanyId(fixedCompanyId ?? extractCompanyId(service?.company));
  }, [service, fixedCompanyId]);
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
        console.error('getCompanies error (ServiceForm):', e);
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
  const currencyOptions: OptionType<ServiceCurrency>[] = [
    {
      value: 'UZS',
      label: 'UZS',
    },
    {
      value: 'USD',
      label: 'USD',
    },
  ];
  const durationOptions: OptionType<'one-time' | 'minutes'>[] = [
    {
      value: 'one-time',
      label: t('ui.one_time'),
    },
    {
      value: 'minutes',
      label: t('ui.by_duration'),
    },
  ];
  const durationUnitOptions: OptionType<DurationUnit>[] = [
    {
      value: 'minutes',
      label: t('ui.minutes'),
    },
    {
      value: 'hours',
      label: t('ui.hours'),
    },
    {
      value: 'days',
      label: t('ui.days'),
    },
    {
      value: 'months',
      label: t('ui.months'),
    },
    {
      value: 'years',
      label: t('ui.years'),
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
    if (durationMode === 'minutes') {
      if (durationValue === '' || Number(durationValue) < 1) {
        setError(t('ui.duration_must_be_greater_than_0'));
        return;
      }
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
    setSaving(true);
    try {
      const payload: Partial<Service> = {
        name: name.trim(),
        description: description.trim(),
        price: normalizedPrice,
        currency,
        active,
        duration_minutes:
          durationMode === 'one-time' ? -1 : Math.max(1, Math.floor(Number(durationValue))) * UNIT_TO_MINUTES[durationUnit],
        cost_price: normalizedCostPrice === '' ? undefined : normalizedCostPrice,
        company: companyId ?? undefined,
      };
      let resp: Service;
      if (fixedCompanyId) {
        if (service && service.id) {
          resp = await updateCompanyService(String(fixedCompanyId), String(service.id), payload);
        } else {
          resp = await createCompanyService(String(fixedCompanyId), payload);
        }
      } else if (service && service.id) {
        resp = await updateService(String(service.id), payload);
      } else {
        resp = await createService(payload);
      }
      await onSuccess(resp);
    } catch (err: any) {
      console.error('ServiceForm save error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.failed_to_save_service');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!service || !service.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_remove_this_2'));
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      if (fixedCompanyId) {
        await deleteCompanyService(String(fixedCompanyId), String(service.id));
      } else {
        await deleteService(String(service.id));
      }
      await onSuccess(service);
    } catch (err: any) {
      console.error('ServiceForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_when_deleting_a_service');
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
          onChange={(v) => setCurrency((v as ServiceCurrency) ?? 'UZS')}
        />
      </div>

      <SelectOption
        label={t('ui.duration')}
        options={durationOptions}
        value={durationMode}
        onChange={(v) => setDurationMode((v as 'one-time' | 'minutes') ?? 'minutes')}
      />

      {durationMode === 'minutes' && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3'>
          <InputDefault
            label={t('ui.duration')}
            type='number'
            min={1}
            step={1}
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
          <SelectOption
            label={t('ui.unit_3')}
            options={durationUnitOptions}
            value={durationUnit}
            onChange={(v) => setDurationUnit((v as DurationUnit) ?? 'minutes')}
          />
        </div>
      )}

      <OptionalSection preferenceId={preferenceIds.optionalSection.serviceFormExtra}>
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
      </OptionalSection>

      <div className='flex items-end'>
        <ToggleSwitch checked={active} onChange={setActive} onLabel={t('ui.available_2')} offLabel={t('ui.not_available_2')} />
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
          {service && service.id && (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={saving}>
              {saving ? t('ui.wait_2') : t('ui.delete')}
            </ButtonDefault>
          )}
        </div>

        <div className='flex gap-3'>
          <ButtonDefault type='button' variant='secondary' onClick={onCancel} disabled={saving}>
            {t('ui.cancel')}
          </ButtonDefault>
          <ButtonDefault type='submit' variant='positive' disabled={saving}>
            {saving ? t('ui.saving') : service ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
