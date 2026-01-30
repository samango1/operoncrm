import { Company } from '@/types/api/companies';

export type ProductCurrency = 'USD' | 'UZS';
export type ProductUnit = 'kilogram' | 'piece' | 'meter' | 'liter';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: ProductCurrency;
  active: boolean;
  stock_quantity: number;
  min_stock_level: number;
  unit: ProductUnit;
  cost_price?: number | null;
  weight?: number | null;
  volume?: number | null;
  company?: Company | string;
  created_at?: string;
  updated_at?: string;
}
