export type PlatformRole = 'admin' | 'agent' | 'member';

export interface User {
  id: string;
  name: string;
  phone: number;
  password?: string;
  platform_role: PlatformRole;
  created_by?: User | null;
}
