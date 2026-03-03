import { Company } from '@/types/api/companies';
import { User } from '@/types/api/users';

export type ClientType = 'individual' | 'company' | 'group';

export interface Client {
  id: string;
  type?: ClientType;
  name: string;
  phone?: string | null;
  description?: string | null;
  company?: Company | string;
  created_by?: User;
  valid?: boolean;
  created_at?: string;
  updated_at?: string;
}
