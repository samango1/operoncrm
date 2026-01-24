'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import TextAreaDefault from '../Inputs/TextAreaDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import { createClient, updateClient, deleteClient, getCompanies } from '@/lib/api';
import type { Client, ClientType } from '@/types/api/clients';
import type { Company } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';

type Props = {
  client?: Client | null;
  onCancel: () => void;
  onSuccess: (client: Client) => void | Promise<void>;
};

const extractCompanyId = (company?: Company | string): string | undefined => {
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  return (company as Company).id ? String((company as Company).id) : undefined;
};

export default function ClientForm({ client, onCancel, onSuccess }: Props) {
  const [name, setName] = useState<string>(client?.name ?? '');
  const [phone, setPhone] = useState<string>(client?.phone ?? '');
  const [description, setDescription] = useState<string>(client?.description ?? '');
  const [type, setType] = useState<'individual' | 'company' | 'group'>(client?.type ?? 'individual');
  const [companyId, setCompanyId] = useState<string | undefined>(extractCompanyId(client?.company));

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(client?.name ?? '');
    setPhone(client?.phone ?? '');
    setDescription(client?.description ?? '');
    setType((client?.type as ClientType) ?? 'individual');
    setCompanyId(extractCompanyId(client?.company));
  }, [client]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingCompanies(true);
      try {
        const res = await getCompanies({ page: 1, page_size: 100 });
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
  }, []);

  const companyOptions: OptionType<string>[] = companies.map((c) => ({
    value: String(c.id),
    label: c.name ?? String(c.id),
  }));

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Имя/название обязательно');
      return;
    }
    if (!phone.trim()) {
      setError('Телефон обязателен');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Client> = {
        name: name.trim(),
        phone: phone.trim(),
        description: description ? description.trim() : undefined,
        type,
        company: companyId ?? undefined,
      };

      let resp: Client;
      if (client && client.id) {
        resp = await updateClient(String(client.id), payload);
      } else {
        resp = await createClient(payload);
      }

      await onSuccess(resp);
    } catch (err: any) {
      console.error('save client error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Не удалось сохранить клиента';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client || !client.id) return;
    const ok = window.confirm('Вы уверены, что хотите удалить этого клиента? Это действие невозможно отменить.');
    if (!ok) return;

    setError(null);
    setSaving(true);
    try {
      await deleteClient(String(client.id));
      if (onSuccess) {
        onSuccess(client);
      }
    } catch (err: any) {
      console.error('ClientForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка при удалении клиента';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <InputDefault value={name} label='Имя / Название' onChange={(e) => setName(e.target.value)} required />

      <InputDefault value={phone} label='Телефон' onChange={(e) => setPhone(e.target.value)} required />

      <SelectOption
        label='Тип'
        options={[
          { value: 'individual', label: 'Физическое лицо' },
          { value: 'company', label: 'Компания' },
          { value: 'group', label: 'Группа' },
        ]}
        value={type}
        onChange={(v) => setType((v as ClientType) ?? 'individual')}
      />

      <SelectOption
        label='Прикреплена к компании'
        placeholder={loadingCompanies ? 'Загрузка компаний...' : 'Выберите компанию'}
        options={companyOptions}
        value={companyId}
        onChange={(v) => setCompanyId(v as string | undefined)}
        required
      />

      <div>
        <label className='mb-1 block text-md font-medium text-gray-700'>Описание</label>
        <TextAreaDefault value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-between'>
        <div>
          {client && client.id && (
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
            {saving ? 'Сохранение...' : client ? 'Сохранить' : 'Создать'}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
