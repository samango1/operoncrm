import { User } from '@/types/api/users';

export type UsagePlan = 'start' | 'basic' | 'advanced';

export interface CompanySlugLookup {
  id: string;
}

export interface CompanyMember {
  id: string;
  telegram_id?: number | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  members?: CompanyMember[];
  plan: UsagePlan;
  created_by: User;
  created_at: string;
  updated_at: string;
}
