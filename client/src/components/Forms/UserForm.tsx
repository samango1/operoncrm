'use client';

import React, { useEffect, useState } from 'react';
import InputDefault from '@/components/Inputs/InputDefault';
import ButtonDefault from '@/components/Buttons/ButtonDefault';
import SelectOption from '../Inputs/SelectOption';
import OptionalField from '@/components/Inputs/OptionalField';
import OptionalSection from '@/components/Containers/OptionalSection';
import { preferenceIds } from '@/lib/preferencesCookies';
import { User, PlatformRole, UserLanguage } from '@/types/api/users';
import { createUser, updateUser, deleteUser } from '@/lib/api';
import { formatLocalPhone, isLocalPhoneComplete, toFullPhoneNumber } from '@/lib/phone';
import { decodeJwtPayload } from '@/lib/jwt';
import { useCookies } from '@/hooks/useCookies';
import { getLocale, setLocale, t } from '@/i18n';

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
  preferences_lang: UserLanguage;
}

const roleOptions: PlatformRole[] = ['admin', 'agent', 'member'];
const DEFAULT_USER_LANG: UserLanguage = 'en';

const UserForm: React.FC<UserFormProps> = ({ user, onSuccess, onCancel }) => {
  const cookies = useCookies();

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    password: '',
    platform_role: '',
    preferences_lang: DEFAULT_USER_LANG,
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
        preferences_lang: user.preferences?.lang ?? DEFAULT_USER_LANG,
      });
    } else {
      setForm({
        name: '',
        phone: '',
        password: '',
        platform_role: '',
        preferences_lang: DEFAULT_USER_LANG,
      });
    }
    setError(null);
    setFieldErrors({});
  }, [user]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!user && !form.password) errs.password = t('ui.password_required');
    if (!isLocalPhoneComplete(form.phone)) errs.phone = t('ui.phone_number_must_contain_9_digits');
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = k === 'phone' ? formatLocalPhone(String(e.target.value)) : e.target.value;
    setForm((prev) => ({ ...prev, [k]: value }));
    setFieldErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const handleRoleChange = (value: PlatformRole | '' | undefined) => {
    if (value === undefined) return;
    setForm((prev) => ({ ...prev, platform_role: value }));
    setFieldErrors((prev) => ({ ...prev, platform_role: '' }));
  };

  const handleLanguageChange = (value: UserLanguage | '' | undefined) => {
    if (!value) return;
    setForm((prev) => ({ ...prev, preferences_lang: value }));
    setFieldErrors((prev) => ({ ...prev, preferences_lang: '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const currentUserLang = user?.preferences?.lang ?? DEFAULT_USER_LANG;
      const shouldSendPreferences = user
        ? form.preferences_lang !== currentUserLang
        : form.preferences_lang !== DEFAULT_USER_LANG;

      const payload: Partial<User> = {
        name: form.name.trim(),
        phone: Number(toFullPhoneNumber(form.phone)),
        platform_role: form.platform_role as PlatformRole,
      };

      if (shouldSendPreferences) {
        payload.preferences = { lang: form.preferences_lang };
      }

      if (form.password) {
        (payload as Partial<User> & { password: string }).password = form.password;
      }

      let resp: User;
      if (user && user.id) {
        resp = await updateUser(String(user.id), payload);
      } else {
        resp = await createUser(payload);
      }

      const accessToken = cookies.get('access');
      const authPayload = decodeJwtPayload(accessToken);
      const currentUserId = authPayload?.user_id ?? authPayload?.id;
      const targetUserId = user?.id ?? resp.id;
      const nextLang = (resp.preferences?.lang ??
        (shouldSendPreferences ? form.preferences_lang : currentUserLang)) as UserLanguage;

      if (
        currentUserId &&
        targetUserId &&
        String(currentUserId) === String(targetUserId) &&
        (nextLang === 'en' || nextLang === 'ru')
      ) {
        cookies.set('lang', nextLang, {
          path: '/',
          sameSite: 'lax',
          secure: window.location.protocol === 'https:',
        });
        const shouldReload = getLocale() !== nextLang;
        setLocale(nextLang);
        if (shouldReload) {
          window.location.reload();
          return;
        }
      }

      if (onSuccess) onSuccess(resp);
    } catch (err: any) {
      console.error('UserForm submit error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_saving_user');
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !user.id) return;
    const ok = window.confirm(t('ui.are_you_sure_you_want_to_delete_this_2'));
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      await deleteUser(String(user.id));
      if (onSuccess) onSuccess(user);
    } catch (err: any) {
      console.error('UserForm delete error:', err);
      const msg = err?.response?.data?.detail || err?.message || t('ui.error_when_deleting_user');
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const selectOptions = roleOptions.map((r) => ({
    label: r[0].toUpperCase() + r.slice(1),
    value: r,
  }));

  const languageOptions: { label: string; value: UserLanguage }[] = [
    { label: t('locale.english'), value: 'en' },
    { label: t('locale.russian'), value: 'ru' },
  ];

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && <div className='text-sm text-red-600'>{error}</div>}

      <InputDefault
        label={t('ui.full_name')}
        name='fullname'
        value={form.name}
        onChange={(e) => handleChange('name')(e)}
        placeholder={t('ui.ivan_ivanov')}
        error={fieldErrors.name}
        required
      />

      <InputDefault
        label={t('ui.phone')}
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
        label={t('ui.role_of_the_platform')}
        name='role'
        placeholder={t('ui.select_a_role')}
        options={selectOptions}
        value={form.platform_role}
        onChange={handleRoleChange}
        error={fieldErrors.platform_role}
        required
      />

      <OptionalSection preferenceId={preferenceIds.optionalSection.userFormExtra}>
        <SelectOption
          label={t('settings.interface_language')}
          name='language'
          placeholder={t('settings.select_language')}
          options={languageOptions}
          value={form.preferences_lang}
          onChange={handleLanguageChange}
        />

        {user ? (
          <InputDefault
            label={
              <>
                {t('ui.password')}
                <OptionalField />
              </>
            }
            name='password'
            type='password'
            value={form.password}
            onChange={(e) => handleChange('password')(e)}
            placeholder={t('ui.leave_it_blank_so_as_not_to_change')}
            error={fieldErrors.password}
          />
        ) : null}
      </OptionalSection>

      {!user ? (
        <InputDefault
          label={t('ui.password')}
          name='password'
          type='password'
          value={form.password}
          onChange={(e) => handleChange('password')(e)}
          placeholder={t('ui.enter_your_password')}
          error={fieldErrors.password}
        />
      ) : null}

      <div className='flex justify-between'>
        <div>
          {user && user.id ? (
            <ButtonDefault type='button' variant='danger' onClick={handleDelete} disabled={loading}>
              {loading ? t('ui.wait') : t('ui.delete')}
            </ButtonDefault>
          ) : null}
        </div>
        <div className='flex gap-3'>
          <ButtonDefault type='button' variant='secondary' onClick={() => onCancel && onCancel()} disabled={loading}>
            {t('ui.cancel')}
          </ButtonDefault>

          <ButtonDefault type='submit' variant='positive' disabled={loading}>
            {loading ? t('ui.saving') : user ? t('ui.save') : t('ui.create')}
          </ButtonDefault>
        </div>
      </div>
    </form>
  );
};

export default UserForm;
