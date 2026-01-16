import { User } from '@/types/api/users';

export type UsagePlan = 'start' | 'basic' | 'basic';

export interface Company {
  id: string;
  name: string;
  slug: string;
  members: Array<Object>;
  plan: UsagePlan;
  created_by: User;
  created_at: string;
  updated_at: string;
}
