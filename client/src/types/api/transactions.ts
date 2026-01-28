import { Client } from './clients';
import { Company } from '@/types/api/companies';

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
  initial_amount: number;
  discount_amount: number;
  amount?: number;
  type: TransactionType;
  method: TransactionMethod;
  date: string;
  description?: string;
  currency: TransactionCurrency;
  client?: Client | string;
  categories?: TransactionCategory[] | string[];
  company: Company | string;
  created_at?: string;
  updated_at?: string;
  valid?: boolean;
}
