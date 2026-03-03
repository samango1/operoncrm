import { Client } from './clients';
import { Company } from '@/types/api/companies';
import { Product } from '@/types/api/products';
import { Service } from '@/types/api/services';

export type TransactionType = 'income' | 'outcome';
export type TransactionMethod = 'cash' | 'card';
export type TransactionCurrency = 'USD' | 'UZS';

export interface TransactionCategory {
  id: string;
  name: string;
  company: Company | string;
  created_by?: string | { id: string; name?: string; phone?: string };
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  initial_amount: string;
  discount_amount: string;
  amount?: string;
  type: TransactionType;
  method: TransactionMethod;
  date: string;
  description?: string | null;
  currency: TransactionCurrency;
  client?: Client | string | null;
  categories?: TransactionCategory[] | string[];
  products?: Product[] | string[];
  services?: Service[] | string[];
  services_starts_at?: string | null;
  company: Company | string;
  created_at?: string;
  updated_at?: string;
  valid?: boolean;
}
