import { Company } from '@/types/api/companies';
import { User } from '@/types/api/users';

export type ClientType = 'individual' | 'company' | 'group';

export interface Client {
  id: string;
  type?: ClientType;
  name: string;
  phone: string;
  description?: string;
  company?: Company | string;
  created_by?: User;
  invalid?: boolean;
  created_at?: string;
  updated_at?: string;
}
