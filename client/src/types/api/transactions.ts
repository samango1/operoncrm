import { User } from '@/types/api/users';
import { Company } from '@/types/api/companies';

export type TransactionType = 'income' | 'outcome';
export type TransactionMethod = 'cash' | 'card';
export type TransactionCurrency = 'USD' | 'UZS';

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
  client?: User | string;
  company: Company | string;
  created_at?: string;
  updated_at?: string;
  invalid?: boolean;
}
