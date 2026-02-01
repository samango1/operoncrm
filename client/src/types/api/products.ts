import { Company } from '@/types/api/companies';

export type ProductCurrency = 'USD' | 'UZS';
export type ProductUnit = 'kilogram' | 'piece' | 'meter' | 'liter';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: ProductCurrency;
  active: boolean;
  stock_quantity: number;
  min_stock_level: number;
  unit: ProductUnit;
  cost_price?: string | null;
  weight?: string | null;
  volume?: string | null;
  company?: Company | string;
  created_at?: string;
  updated_at?: string;
}
