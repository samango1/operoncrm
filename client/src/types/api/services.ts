import { Company } from '@/types/api/companies';

export type ServiceCurrency = 'USD' | 'UZS';

export interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: ServiceCurrency;
  active: boolean;
  duration_minutes: number;
  cost_price?: string | null;
  company?: Company | string;
  created_at?: string;
  updated_at?: string;
}
