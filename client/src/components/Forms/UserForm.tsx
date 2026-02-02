'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SelectOption from '../Inputs/SelectOption';
import OptionalField from '@/components/Inputs/OptionalField';
import OptionalSection from '@/components/Containers/OptionalSection';

import { User, PlatformRole } from '@/types/api/users';
import { createUser, updateUser, deleteUser } from '@/lib/api';
import { formatLocalPhone, isLocalPhoneComplete, toFullPhoneNumber } from '@/lib/phone';

interface UserFormProps {
  user?: User | null;
  onSuccess?: (user: User) => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  phone: string;
  password: string;
  platform_role: PlatformRole | '';
}

const roleOptions: PlatformRole[] = ['admin', 'agent', 'member'];

const UserForm: React.FC<UserFormProps> = ({ user, onSuccess, onCancel }) => {
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    password: '',
    platform_role: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? '',
        phone: formatLocalPhone(String(user.phone ?? '')),
        password: '',
        platform_role: (user.platform_role as PlatformRole) ?? '',
      });
    } else {
      setForm({
        name: '',
        phone: '',
        password: '',
        platform_role: '',
      });
    }
    setError(null);
    setFieldErrors({});
  }, [user]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!user && !form.password) errs.password = 'Пароль обязателен';
    if (!isLocalPhoneComplete(form.phone)) errs.phone = 'Телефон должен содержать 9 цифр';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = k === 'phone' ? formatLocalPhone(String(e.target.value)) : e.target.value;
    setForm((prev) => ({ ...prev, [k]: value }));
    setFieldErrors((prev) => ({ ...prev, [k]: '' }));
  };
  const handleSelectChange = (value: PlatformRole | '' | undefined) => {
    if (value === undefined) return;
    setForm((prev) => ({ ...prev, platform_role: value }));
    setFieldErrors((prev) => ({ ...prev, platform_role: '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const payload: Partial<User> = {
        name: form.name.trim(),
        phone: Number(toFullPhoneNumber(form.phone)),
        platform_role: form.platform_role as PlatformRole,
      };

      if (form.password) {
        (payload as any).password = form.password;
      }

      let resp: User;
      if (user && user.id) {
        resp = await updateUser(String(user.id), payload);
      } else {
        resp = await createUser(payload);
      }

      if (onSuccess) onSuccess(resp);
    } catch (err: any) {
      console.error('UserForm submit error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка при сохранении пользователя';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !user.id) return;
    const ok = window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие невозможно отменить.');
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      await deleteUser(String(user.id));
      if (onSuccess) {
        onSuccess(user);
      }
    } catch (err: any) {
      console.error('UserForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Ошибка при удалении пользователя';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const selectOptions = roleOptions.map((r) => ({
    label: r[0].toUpperCase() + r.slice(1),
    value: r,
  }));

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && <div className='text-sm text-red-600'>{error}</div>}

      <InputDefault
        label='ФИО'
        name='fullname'
        value={form.name}
        onChange={(e) => handleChange('name')(e)}
        placeholder='Иван Иванов'
        error={fieldErrors.name}
        required
      />

      <InputDefault
        label='Телефон'
        prewritten='+998'
        value={form.phone}
        name='phone'
        type='tel'
        inputMode='numeric'
        maxLength={12}
        autoComplete='tel'
        onChange={(e) => handleChange('phone')(e)}
        placeholder='90 123 45 67'
        error={fieldErrors.phone}
        required
      />

      <SelectOption
        label='Роль платформы'
        name='role'
        placeholder='Выберите роль'
        options={selectOptions}
        value={form.platform_role}
        onChange={handleSelectChange}
        error={fieldErrors.platform_role}
        required
      />

      {user ? (
        <OptionalSection>
          <InputDefault
            label={
              <>
                Пароль
                <OptionalField />
              </>
            }
            name='password'
            type='password'
            value={form.password}
            onChange={(e) => handleChange('password')(e)}
            placeholder='Оставьте пустым чтобы не менять'
            error={fieldErrors.password}
          />
        </OptionalSection>
      ) : (
        <InputDefault
          label='Пароль'
          name='password'
          type='password'
          value={form.password}
          onChange={(e) => handleChange('password')(e)}
          placeholder='Введите пароль'
          error={fieldErrors.password}
        />
      )}

      <div className='flex justify-between'>
        <div>
          {user && user.id && (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={loading}>
              {loading ? 'Подожди...' : 'Удалить'}
            </ButtonDefault>
          )}
        </div>
        <div className='flex gap-3'>
          <ButtonDefault type='button' variant='secondary' onClick={() => onCancel && onCancel()} disabled={loading}>
            Отмена
          </ButtonDefault>

          <ButtonDefault type='submit' variant='positive' disabled={loading}>
            {loading ? 'Сохраняю...' : user ? 'Сохранить' : 'Создать'}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
};

export default UserForm;
