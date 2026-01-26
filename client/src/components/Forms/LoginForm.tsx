'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { login } from '@/lib/api';
import { useCookies } from '@/hooks/useCookies';
import { getJwtExpiryDate } from '@/lib/jwt';
import { formatLocalPhone, isLocalPhoneComplete, toFullPhoneNumber } from '@/lib/phone';
import InputDefault from '@/components/Inputs/InputDefault';
import ButtonDefault from '../Buttons/ButtonDefault';

interface FormState {
  phone: string;
  password: string;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const cookies = useCookies();

  const [state, setState] = useState<FormState>({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setState((s) => ({ ...s, phone: formatLocalPhone(value) }));
      return;
    }
    setState((s) => ({ ...s, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!isLocalPhoneComplete(state.phone)) {
        setError('Введите корректный номер телефона');
        setLoading(false);
        return;
      }
      const payload = {
        phone: toFullPhoneNumber(state.phone),
        password: state.password,
      };

      const tokens = await login(payload);

      const secure = window.location.protocol === 'https:';

      const accessExp = getJwtExpiryDate(tokens.access);
      const refreshExp = getJwtExpiryDate(tokens.refresh);

      cookies.set('access', tokens.access, {
        path: '/',
        expires: accessExp ?? undefined,
        sameSite: 'lax',
        secure,
      });

      cookies.set('refresh', tokens.refresh, {
        path: '/',
        expires: refreshExp ?? undefined,
        sameSite: 'lax',
        secure,
      });

      window.location.replace(next || '/');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? 'Не удалось выполнить вход. Проверьте телефон и пароль.');
      setLoading(false);
    }
  };

  return (
    <div className='max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded-lg'>
      <h2 className='mb-3 text-2xl font-bold'>Вход в систему</h2>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <InputDefault
          label='Телефон'
          name='phone'
          value={state.phone}
          onChange={handleChange}
          placeholder='90 123 45 67'
          prewritten='+998'
          type='tel'
          inputMode='numeric'
          maxLength={12}
          autoComplete='tel'
          required
        />

        <InputDefault
          label='Пароль'
          name='password'
          type='password'
          value={state.password}
          onChange={handleChange}
          placeholder='••••••••'
          required
        />

        {error && <div className='text-red-600'>Не удалось авторизоваться</div>}

        <ButtonDefault type='submit' variant='dark' className='w-full' disabled={loading}>
          {loading ? 'Загрузка...' : 'Войти'}
        </ButtonDefault>
      </form>
    </div>
  );
}
