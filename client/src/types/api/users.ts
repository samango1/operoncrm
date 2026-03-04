export type PlatformRole = 'admin' | 'agent' | 'member';
export type UserLanguage = 'en' | 'ru';

export interface UserPreferences {
  lang: UserLanguage;
}

export interface User {
  id: string;
  name: string;
  phone: number;
  password?: string;
  platform_role: PlatformRole;
  preferences?: UserPreferences;
  created_by?: User | null;
}
