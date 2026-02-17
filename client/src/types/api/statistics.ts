import type { TransactionCurrency, TransactionMethod, TransactionType } from '@/types/api/transactions';

export type StatisticsGroupBy = 'day' | 'week' | 'month';

export interface CompanyStatisticsQuery {
  date_from?: string;
  date_to?: string;
  group_by?: StatisticsGroupBy;
  types?: TransactionType[];
  methods?: TransactionMethod[];
  currencies?: TransactionCurrency[];
  category_ids?: string[];
  product_ids?: string[];
  service_ids?: string[];
  client_ids?: string[];
  valid?: boolean;
  top?: number;
}

export interface CompanyStatisticsFilters {
  date_from?: string | null;
  date_to?: string | null;
  group_by: StatisticsGroupBy;
  types: string[];
  methods: string[];
  currencies: string[];
  category_ids: string[];
  product_ids: string[];
  service_ids: string[];
  client_ids: string[];
  valid?: boolean | null;
  top: number;
}

export interface StatisticsKeyAmountItem {
  key: string;
  label: string;
  count: number;
  amount: string;
}

export interface StatisticsNamedAmountItem {
  id: string;
  name: string;
  count: number;
  amount: string;
}

export interface StatisticsNamedUnitsItem {
  id: string;
  name: string;
  transactions_count: number;
  units: number;
}

export interface CompanyStatisticsSummary {
  transactions_count: number;
  income_transactions_count: number;
  outcome_transactions_count: number;
  clients_with_transactions: number;
  products_units: number;
  services_units: number;
  income_total: string;
  outcome_total: string;
  total_amount: string;
  discount_total: string;
  balance: string;
  average_transaction: string;
}

export interface CompanyStatisticsTrendPoint {
  period: string;
  transactions_count: number;
  income: string;
  outcome: string;
  balance: string;
}

export interface CompanyStatisticsBreakdowns {
  types: StatisticsKeyAmountItem[];
  methods: StatisticsKeyAmountItem[];
  currencies: StatisticsKeyAmountItem[];
  categories: StatisticsNamedAmountItem[];
  clients: StatisticsNamedAmountItem[];
  products: StatisticsNamedUnitsItem[];
  services: StatisticsNamedUnitsItem[];
}

export interface CompanyStatistics {
  filters: CompanyStatisticsFilters;
  summary: CompanyStatisticsSummary;
  trend: CompanyStatisticsTrendPoint[];
  breakdowns: CompanyStatisticsBreakdowns;
}
