'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import TextAreaDefault from '../Inputs/TextAreaDefault';
import OptionalField from '@/components/Inputs/OptionalField';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import OptionalSection from '@/components/Containers/OptionalSection';
import { preferenceIds } from '@/lib/preferencesCookies';
import {
  createClient,
  updateClient,
  deleteClient,
  getCompanies,
  createCompanyClient,
  updateCompanyClient,
  deleteCompanyClient,
} from '@/lib/api';
import { formatLocalPhone, isLocalPhoneComplete, toFullPhoneNumber } from '@/lib/phone';
import type { Client, ClientType } from '@/types/api/clients';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';
import { t } from '@/i18n';
type Props = {
  client?: Client | null;
  onCancel: () => void;
  onSuccess: (client: Client) => void | Promise<void>;
  fixedCompanyId?: string;
  companiesOverride?: Company[];
};
const extractCompanyId = (company?: Company | string): string | undefined => {
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  return (company as Company).id ? String((company as Company).id) : undefined;
};
export default function ClientForm({ client, onCancel, onSuccess, fixedCompanyId, companiesOverride }: Props) {
  const [name, setName] = useState<string>(client?.name ?? '');
  const [phone, setPhone] = useState<string>(formatLocalPhone(client?.phone ?? ''));
  const [description, setDescription] = useState<string>(client?.description ?? '');
  const [type, setType] = useState<'individual' | 'company' | 'group'>(client?.type ?? 'individual');
  const [companyId, setCompanyId] = useState<string | undefined>(fixedCompanyId ?? extractCompanyId(client?.company));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  useEffect(() => {
    setName(client?.name ?? '');
    setPhone(formatLocalPhone(client?.phone ?? ''));
    setDescription(client?.description ?? '');
    setType((client?.type as ClientType) ?? 'individual');
    setCompanyId(fixedCompanyId ?? extractCompanyId(client?.company));
  }, [client, fixedCompanyId]);
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
          page_size: 100,
        });
        if (!mounted) return;
        setCompanies(res.results ?? res);
      } catch (e) {
        console.error('getCompanies error (ClientForm):', e);
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
      setError(t('ui.name_title_required'));
      return;
    }
    if (!fixedCompanyId && !companyId) {
      setCompanyError(t('ui.company_is_required'));
      return;
    }
    if (!isLocalPhoneComplete(phone)) {
      setError(t('ui.phone_number_must_contain_9_digits'));
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Client> = {
        name: name.trim(),
        phone: toFullPhoneNumber(phone),
        description: description ? description.trim() : undefined,
        type,
        company: companyId ?? undefined,
      };
      let resp: Client;
      if (fixedCompanyId) {
        if (client && client.id) {
          resp = await updateCompanyClient(String(fixedCompanyId), String(client.id), payload);
        } else {
          resp = await createCompanyClient(String(fixedCompanyId), payload);
        }
      } else if (client && client.id) {
        resp = await updateClient(String(client.id), payload);
      } else {
        resp = await createClient(payload);
      }
      await onSuccess(resp);
    } catch (err: any) {
      console.error('save client error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.failed_to_save_client');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!client || !client.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_delete_this'));
    if (!ok) return;
    setError(null);
    setSaving(true);
    try {
      if (fixedCompanyId) {
        await deleteCompanyClient(String(fixedCompanyId), String(client.id));
      } else {
        await deleteClient(String(client.id));
      }
      if (onSuccess) {
        onSuccess(client);
      }
    } catch (err: any) {
      console.error('ClientForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_when_deleting_client');
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <InputDefault value={name} label={t('ui.name_title')} onChange={(e) => setName(e.target.value)} required />

      <InputDefault
        value={phone}
        label={t('ui.phone')}
        prewritten='+998'
        type='tel'
        inputMode='numeric'
        maxLength={12}
        autoComplete='tel'
        placeholder='90 123 45 67'
        onChange={(e) => setPhone(formatLocalPhone(e.target.value))}
        required
      />

      <SelectOption
        label={t('ui.type')}
        options={[
          {
            value: 'individual',
            label: t('ui.individual'),
          },
          {
            value: 'company',
            label: t('ui.company'),
          },
          {
            value: 'group',
            label: t('ui.group'),
          },
        ]}
        value={type}
        onChange={(v) => setType((v as ClientType) ?? 'individual')}
      />

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

      <OptionalSection preferenceId={preferenceIds.optionalSection.clientFormExtra}>
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
      </OptionalSection>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-between'>
        <div>
          {client && client.id && (
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
            {saving ? t('ui.saving') : client ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
