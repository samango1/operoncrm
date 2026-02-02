'use client';

import React, { useEffect, useRef, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import SelectOption from '@/components/Inputs/SelectOption';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SelectMultiple from '@/components/Inputs/SelectMultiple';
import OptionalField from '@/components/Inputs/OptionalField';
import OptionalSection from '@/components/Containers/OptionalSection';

import { getUsers, getUserById, createCompany, updateCompany, deleteCompany } from '@/lib/api';
import type { User } from '@/types/api/users';
import type { Company, UsagePlan } from '@/types/api/companies';
import type { SelectOption as OptionType } from '@/components/Inputs/SelectOption';

type Props = {
  company?: Company | null;
  onCancel: () => void;
  onSuccess: (company: Company) => void | Promise<void>;
};

export default function CompanyForm({ company, onCancel, onSuccess }: Props) {
  const [name, setName] = useState<string>(company?.name ?? '');
  const [slug, setSlug] = useState<string>(company?.slug ?? '');
  const [plan, setPlan] = useState<UsagePlan>(company?.plan ?? ('start' as UsagePlan));
  const [members, setMembers] = useState<string[]>(company?.members.map((m) => m.id) ?? []);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [updatingMembers, setUpdatingMembers] = useState(false);

  const prevMembersRef = useRef<string[]>(members);
  useEffect(() => {
    prevMembersRef.current = members;
  }, [members]);

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      try {
        const resp = await getUsers({ page: 1, page_size: 100 });
        setUsers(resp.results ?? []);
      } catch (e) {
        console.error('getUsers error:', e);
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setName(company?.name ?? '');
    setSlug(company?.slug ?? '');
    setPlan(company?.plan ?? ('start' as UsagePlan));
    const membersArr = company?.members.map((m) => m.id) ?? [];
    setMembers(membersArr);
    prevMembersRef.current = membersArr;
  }, [company]);

  useEffect(() => {
    const missingIds = members.filter((m) => !users.some((u) => String(u.id) === String(m)));
    if (missingIds.length === 0) return;

    let mounted = true;
    (async () => {
      try {
        const fetched: User[] = [];
        for (const id of missingIds) {
          try {
            const u = await getUserById(id);
            fetched.push(u);
          } catch (e) {
            console.warn('getUserById error for', id, e);
          }
        }
        if (!mounted) return;
        if (fetched.length > 0) {
          setUsers((prev) => {
            const ids = new Set(prev.map((p) => String(p.id)));
            const toAdd = fetched.filter((f) => !ids.has(String(f.id)));
            return [...prev, ...toAdd];
          });
        }
      } finally {
      }
    })();

    return () => {
      mounted = false;
    };
  }, [members, users]);

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const handleNameBlur = () => {
    if (!slug && name) {
      setSlug(slugify(name));
    }
  };

  const userOptions: OptionType<string>[] = users.map((u) => ({
    value: u.id,
    label: u.name ?? String(u.id),
  }));

  const handleMembersChange = async (val: string[] | string | undefined) => {
    setError(null);

    const newMembers = !val ? [] : Array.isArray(val) ? val : [val];

    if (company && company.id) {
      const prev = prevMembersRef.current;
      const payload: Partial<Company> = {
        members: newMembers.map((id) => ({ id })),
      };

      setUpdatingMembers(true);
      try {
        const resp = await updateCompany(String(company.id), payload);
        const returnedMembers = resp.members.map((m) => m.id);
        setMembers(returnedMembers);
        prevMembersRef.current = returnedMembers;

        const missing = returnedMembers.filter((m) => !users.some((u) => String(u.id) === String(m)));
        if (missing.length > 0) {
          const fetched: User[] = [];
          for (const id of missing) {
            try {
              const u = await getUserById(id);
              fetched.push(u);
            } catch (e) {
              console.warn('getUserById during members update failed for', id, e);
            }
          }
          if (fetched.length > 0) {
            setUsers((prev) => {
              const ids = new Set(prev.map((p) => String(p.id)));
              const toAdd = fetched.filter((f) => !ids.has(String(f.id)));
              return [...prev, ...toAdd];
            });
          }
        }
      } catch (err: any) {
        console.error('updateCompany (members) failed:', err);
        setError('Не удалось обновить участников. Попробуйте снова.');
        setMembers(prev);
        prevMembersRef.current = prev;
      } finally {
        setUpdatingMembers(false);
      }
    } else {
      setMembers(newMembers);
      prevMembersRef.current = newMembers;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Название обязательно');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Company> = {
        name: name.trim(),
        slug: slug ? slugify(slug) : slugify(name),
        plan,
        members: members.map((m) => ({ id: m })),
      };

      let resp: Company;
      if (company && company.id) {
        resp = await updateCompany(String(company.id), payload);
      } else {
        resp = await createCompany(payload);
      }

      await onSuccess(resp);
    } catch (err: any) {
      console.error('save company error:', err);
      const msg =
        (err?.response?.data && typeof err.response.data === 'string' ? err.response.data : err?.message) ??
        'Не удалось сохранить компанию';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!company || !company.id) return;
    const ok = window.confirm('Вы уверены, что хотите удалить эту компанию? Это действие невозможно отменить.');
    if (!ok) return;

    setError(null);
    setSaving(true);
    try {
      await deleteCompany(String(company.id));
      if (onSuccess) {
        onSuccess(company);
      }
    } catch (err: any) {
      console.error('UserForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка при удалении компании';
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <InputDefault
        value={name}
        label='Название'
        onChange={(e) => setName(e.target.value)}
        onBlur={handleNameBlur}
        placeholder='Название компании'
        required
      />

      <SelectOption
        value={plan}
        label='План'
        onChange={(v) => setPlan(v as UsagePlan)}
        options={[
          { label: 'Start', value: 'start' },
          { label: 'Basic', value: 'basic' },
        ]}
        placeholder='Выберите план'
      />

      <OptionalSection>
        <InputDefault
          value={slug}
          label={
            <>
              Slug
              <OptionalField />
            </>
          }
          onChange={(e) => setSlug(e.target.value)}
          placeholder='slug (будет использован в URL)'
        />

        <SelectMultiple
          label={
            <>
              Члены компании
              <OptionalField />
            </>
          }
          options={userOptions}
          value={members}
          onChange={handleMembersChange}
          placeholder={loadingUsers ? 'Загрузка пользователей...' : 'Выберите пользователя'}
          disabled={loadingUsers || updatingMembers || saving}
        />
      </OptionalSection>

      {error && <div className='text-sm text-red-600'>{error}</div>}

      <div className='flex justify-between'>
        <div>
          {company && company.id && (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={saving}>
              {saving ? 'Подожди...' : 'Удалить'}
            </ButtonDefault>
          )}
        </div>
        <div className='flex gap-3'>
          <ButtonDefault type='button' onClick={onCancel} variant='secondary' disabled={saving || updatingMembers}>
            Отмена
          </ButtonDefault>
          <ButtonDefault type='submit' variant='positive' disabled={saving || updatingMembers}>
            {saving ? 'Сохранение...' : company ? 'Сохранить' : 'Создать'}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
}
