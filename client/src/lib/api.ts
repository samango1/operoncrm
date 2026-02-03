import axios from 'axios';

import { LoginPayload, TokenResponse, RefreshPayload, AccessTokenResponse } from '@/types/api/auth';
import { PaginatedResponse } from '@/types/api/pagination';
import { BaseQuery } from '@/types/api/common';
import { User } from '@/types/api/users';
import { Company } from '@/types/api/companies';
import { Transaction, TransactionCategory } from '@/types/api/transactions';
import { Client } from '@/types/api/clients';
import { Product } from '@/types/api/products';
import { Service } from '@/types/api/services';
import { ClientService } from '@/types/api/client-services';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:9999/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|; )' + name.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

apiClient.interceptors.request.use(
  (config) => {
    try {
      const access = getCookie('access');
      if (access && config && config.headers) {
        config.headers['Authorization'] = `Bearer ${access}`;
      } else {
        if (config && config.headers) delete config.headers['Authorization'];
      }
    } catch (e) {
      console.log(e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!error.response) return Promise.reject(error);

    if (error.response.status === 403) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname || '';
        const areaPrefix = path.startsWith('/admin') ? '/admin' : path.startsWith('/agent') ? '/agent' : '';
        if (areaPrefix) {
          window.location.replace(`${areaPrefix}/not-allowed`);
        } else if (path.startsWith('/tenant/')) {
          const parts = path.split('/').filter(Boolean);
          const tenantBase = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : '/tenant';
          window.location.replace(`${tenantBase}/not-allowed`);
        } else {
          window.location.replace('/not-allowed');
        }
      }
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = getCookie('refresh');
        if (!refresh) {
          return Promise.reject(error);
        }

        const resp = await apiClient.post<AccessTokenResponse>('/token/refresh/', { refresh });
        const newAccess = resp.data.access;

        const expires = (() => {
          try {
            const payload = newAccess.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return decoded?.exp ? new Date(decoded.exp * 1000).toUTCString() : '';
          } catch {
            return '';
          }
        })();
        document.cookie = `access=${encodeURIComponent(newAccess)}; Path=/; ${expires ? `Expires=${expires};` : ''} SameSite=Lax`;

        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

function cleanParams<T extends Record<string, any> | undefined>(params?: T): Partial<T> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

async function getPaginated<T>(url: string, query?: BaseQuery): Promise<PaginatedResponse<T>> {
  const params = cleanParams(query);
  const response = await apiClient.get<PaginatedResponse<T>>(url, { params });
  return response.data;
}

// AUTHENTICATION
export const login = async (payload: LoginPayload): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>('/token/', payload);
  return response.data;
};
export const refreshToken = async (payload: RefreshPayload): Promise<AccessTokenResponse> => {
  const response = await apiClient.post<AccessTokenResponse>('/token/refresh/', payload);
  return response.data;
};

// USERS
export const getUsers = async (query?: BaseQuery): Promise<PaginatedResponse<User>> => {
  return getPaginated<User>('/users/', query);
};
export const getUserById = async (id: string, query?: BaseQuery): Promise<User> => {
  const params = cleanParams(query);
  const response = await apiClient.get<User>(`/users/${id}/`, { params });
  return response.data;
};
export const createUser = async (payload: Partial<User>): Promise<User> => {
  const response = await apiClient.post<User>('/users/', payload);
  return response.data;
};
export const updateUser = async (id: string, payload: Partial<User>): Promise<User> => {
  const response = await apiClient.patch<User>(`/users/${id}/`, payload);
  return response.data;
};
export const deleteUser = async (id: string): Promise<User> => {
  const response = await apiClient.delete<User>(`/users/${id}/`);
  return response.data;
};

// COMPANIES
export const getCompanies = async (query?: BaseQuery): Promise<PaginatedResponse<Company>> => {
  return getPaginated<Company>('/companies/', query);
};
export const getCompanyBySlug = async (slug: string, query?: BaseQuery): Promise<Company> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Company>(`/companies/slug/${slug}/`, { params });
  return response.data;
};
export const getCompanyById = async (id: string, query?: BaseQuery): Promise<Company> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Company>(`/companies/${id}/`, { params });
  return response.data;
};
export const createCompany = async (payload: Partial<Company>): Promise<Company> => {
  const response = await apiClient.post<Company>('/companies/', payload);
  return response.data;
};
export const updateCompany = async (id: string, payload: Partial<Company>): Promise<Company> => {
  const response = await apiClient.patch<Company>(`/companies/${id}/`, payload);
  return response.data;
};
export const deleteCompany = async (id: string): Promise<Company> => {
  const response = await apiClient.delete<Company>(`/companies/${id}/`);
  return response.data;
};

// COMPANIES TRANSACTIONS
export const getCompanyTransactions = async (companyId: string, query?: BaseQuery): Promise<PaginatedResponse<Transaction>> => {
  return getPaginated<Transaction>(`/companies/${companyId}/transactions/`, query);
};
export const createCompanyTransaction = async (companyId: string, payload: Partial<Transaction>): Promise<Transaction> => {
  const response = await apiClient.post<Transaction>(`/companies/${companyId}/transactions/`, payload);
  return response.data;
};
export const getCompanyTransactionById = async (companyId: string, transactionId: string): Promise<Transaction> => {
  const response = await apiClient.get<Transaction>(`/companies/${companyId}/transactions/${transactionId}/`);
  return response.data;
};
export const updateCompanyTransaction = async (
  companyId: string,
  transactionId: string,
  payload: Partial<Transaction>
): Promise<Transaction> => {
  const response = await apiClient.patch<Transaction>(`/companies/${companyId}/transactions/${transactionId}/`, payload);
  return response.data;
};
export const deleteCompanyTransaction = async (companyId: string, transactionId: string): Promise<Transaction> => {
  const response = await apiClient.delete<Transaction>(`/companies/${companyId}/transactions/${transactionId}/`);
  return response.data;
};

// COMPANIES CLIENTS
export const getCompanyClients = async (companyId: string, query?: BaseQuery): Promise<PaginatedResponse<Client>> => {
  return getPaginated<Client>(`/companies/${companyId}/clients/`, query);
};
export const createCompanyClient = async (companyId: string, payload: Partial<Client>): Promise<Client> => {
  const response = await apiClient.post<Client>(`/companies/${companyId}/clients/`, payload);
  return response.data;
};
export const getCompanyClientById = async (companyId: string, clientId: string): Promise<Client> => {
  const response = await apiClient.get<Client>(`/companies/${companyId}/clients/${clientId}/`);
  return response.data;
};
export const updateCompanyClient = async (companyId: string, clientId: string, payload: Partial<Client>): Promise<Client> => {
  const response = await apiClient.patch<Client>(`/companies/${companyId}/clients/${clientId}/`, payload);
  return response.data;
};
export const deleteCompanyClient = async (companyId: string, clientId: string): Promise<Client> => {
  const response = await apiClient.delete<Client>(`/companies/${companyId}/clients/${clientId}/`);
  return response.data;
};

// COMPANIES TRANSACTION CATEGORIES
export const getCompanyTransactionCategories = async (
  companyId: string,
  query?: BaseQuery
): Promise<PaginatedResponse<TransactionCategory>> => {
  return getPaginated<TransactionCategory>(`/companies/${companyId}/transaction-categories/`, query);
};
export const createCompanyTransactionCategory = async (
  companyId: string,
  payload: Partial<TransactionCategory>
): Promise<TransactionCategory> => {
  const response = await apiClient.post<TransactionCategory>(`/companies/${companyId}/transaction-categories/`, payload);
  return response.data;
};
export const getCompanyTransactionCategoryById = async (
  companyId: string,
  categoryId: string
): Promise<TransactionCategory> => {
  const response = await apiClient.get<TransactionCategory>(`/companies/${companyId}/transaction-categories/${categoryId}/`);
  return response.data;
};
export const updateCompanyTransactionCategory = async (
  companyId: string,
  categoryId: string,
  payload: Partial<TransactionCategory>
): Promise<TransactionCategory> => {
  const response = await apiClient.patch<TransactionCategory>(
    `/companies/${companyId}/transaction-categories/${categoryId}/`,
    payload
  );
  return response.data;
};
export const deleteCompanyTransactionCategory = async (companyId: string, categoryId: string): Promise<TransactionCategory> => {
  const response = await apiClient.delete<TransactionCategory>(`/companies/${companyId}/transaction-categories/${categoryId}/`);
  return response.data;
};

// COMPANIES PRODUCTS
export const getCompanyProducts = async (companyId: string, query?: BaseQuery): Promise<PaginatedResponse<Product>> => {
  return getPaginated<Product>(`/companies/${companyId}/products/`, query);
};
export const createCompanyProduct = async (companyId: string, payload: Partial<Product>): Promise<Product> => {
  const response = await apiClient.post<Product>(`/companies/${companyId}/products/`, payload);
  return response.data;
};
export const getCompanyProductById = async (companyId: string, productId: string): Promise<Product> => {
  const response = await apiClient.get<Product>(`/companies/${companyId}/products/${productId}/`);
  return response.data;
};
export const updateCompanyProduct = async (
  companyId: string,
  productId: string,
  payload: Partial<Product>
): Promise<Product> => {
  const response = await apiClient.patch<Product>(`/companies/${companyId}/products/${productId}/`, payload);
  return response.data;
};
export const deleteCompanyProduct = async (companyId: string, productId: string): Promise<Product> => {
  const response = await apiClient.delete<Product>(`/companies/${companyId}/products/${productId}/`);
  return response.data;
};

// COMPANIES SERVICES
export const getCompanyServices = async (companyId: string, query?: BaseQuery): Promise<PaginatedResponse<Service>> => {
  return getPaginated<Service>(`/companies/${companyId}/services/`, query);
};
export const createCompanyService = async (companyId: string, payload: Partial<Service>): Promise<Service> => {
  const response = await apiClient.post<Service>(`/companies/${companyId}/services/`, payload);
  return response.data;
};
export const getCompanyServiceById = async (companyId: string, serviceId: string): Promise<Service> => {
  const response = await apiClient.get<Service>(`/companies/${companyId}/services/${serviceId}/`);
  return response.data;
};
export const updateCompanyService = async (
  companyId: string,
  serviceId: string,
  payload: Partial<Service>
): Promise<Service> => {
  const response = await apiClient.patch<Service>(`/companies/${companyId}/services/${serviceId}/`, payload);
  return response.data;
};
export const deleteCompanyService = async (companyId: string, serviceId: string): Promise<Service> => {
  const response = await apiClient.delete<Service>(`/companies/${companyId}/services/${serviceId}/`);
  return response.data;
};

// TRANSACTIONS
export const getTransactions = async (query?: BaseQuery): Promise<PaginatedResponse<Transaction>> => {
  return getPaginated<Transaction>('/transactions/', query);
};
export const getTransactionById = async (id: string, query?: BaseQuery): Promise<Transaction> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Transaction>(`/transactions/${id}/`, { params });
  return response.data;
};
export const createTransaction = async (payload: Partial<Transaction>): Promise<Transaction> => {
  const response = await apiClient.post<Transaction>('/transactions/', payload);
  return response.data;
};
export const updateTransaction = async (id: string, payload: Partial<Transaction>): Promise<Transaction> => {
  const response = await apiClient.patch<Transaction>(`/transactions/${id}/`, payload);
  return response.data;
};
export const deleteTransaction = async (id: string): Promise<Transaction> => {
  const response = await apiClient.delete<Transaction>(`/transactions/${id}/`);
  return response.data;
};

// TRANSACTION CATEGORIES
export const getTransactionCategories = async (query?: BaseQuery): Promise<PaginatedResponse<TransactionCategory>> => {
  return getPaginated<TransactionCategory>('/transaction-categories/', query);
};
export const getTransactionCategoryById = async (id: string, query?: BaseQuery): Promise<TransactionCategory> => {
  const params = cleanParams(query);
  const response = await apiClient.get<TransactionCategory>(`/transaction-categories/${id}/`, { params });
  return response.data;
};
export const createTransactionCategory = async (payload: Partial<TransactionCategory>): Promise<TransactionCategory> => {
  const response = await apiClient.post<TransactionCategory>('/transaction-categories/', payload);
  return response.data;
};
export const updateTransactionCategory = async (
  id: string,
  payload: Partial<TransactionCategory>
): Promise<TransactionCategory> => {
  const response = await apiClient.patch<TransactionCategory>(`/transaction-categories/${id}/`, payload);
  return response.data;
};
export const deleteTransactionCategory = async (id: string): Promise<TransactionCategory> => {
  const response = await apiClient.delete<TransactionCategory>(`/transaction-categories/${id}/`);
  return response.data;
};

// PRODUCTS
export const getProducts = async (query?: BaseQuery): Promise<PaginatedResponse<Product>> => {
  return getPaginated<Product>('/products/', query);
};
export const getProductById = async (id: string, query?: BaseQuery): Promise<Product> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Product>(`/products/${id}/`, { params });
  return response.data;
};
export const createProduct = async (payload: Partial<Product>): Promise<Product> => {
  const response = await apiClient.post<Product>('/products/', payload);
  return response.data;
};
export const updateProduct = async (id: string, payload: Partial<Product>): Promise<Product> => {
  const response = await apiClient.patch<Product>(`/products/${id}/`, payload);
  return response.data;
};
export const deleteProduct = async (id: string): Promise<Product> => {
  const response = await apiClient.delete<Product>(`/products/${id}/`);
  return response.data;
};

// SERVICES
export const getServices = async (query?: BaseQuery): Promise<PaginatedResponse<Service>> => {
  return getPaginated<Service>('/services/', query);
};
export const getServiceById = async (id: string, query?: BaseQuery): Promise<Service> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Service>(`/services/${id}/`, { params });
  return response.data;
};
export const createService = async (payload: Partial<Service>): Promise<Service> => {
  const response = await apiClient.post<Service>('/services/', payload);
  return response.data;
};
export const updateService = async (id: string, payload: Partial<Service>): Promise<Service> => {
  const response = await apiClient.patch<Service>(`/services/${id}/`, payload);
  return response.data;
};
export const deleteService = async (id: string): Promise<Service> => {
  const response = await apiClient.delete<Service>(`/services/${id}/`);
  return response.data;
};

// CLIENTS
export const getClients = async (query?: BaseQuery): Promise<PaginatedResponse<Client>> => {
  return getPaginated<Client>('/clients/', query);
};
export const getClientById = async (id: string, query?: BaseQuery): Promise<Client> => {
  const params = cleanParams(query);
  const response = await apiClient.get<Client>(`/clients/${id}/`, { params });
  return response.data;
};
export const createClient = async (payload: Partial<Client>): Promise<Client> => {
  const response = await apiClient.post<Client>('/clients/', payload);
  return response.data;
};
export const updateClient = async (id: string, payload: Partial<Client>): Promise<Client> => {
  const response = await apiClient.patch<Client>(`/clients/${id}/`, payload);
  return response.data;
};
export const deleteClient = async (id: string): Promise<Client> => {
  const response = await apiClient.delete<Client>(`/clients/${id}/`);
  return response.data;
};

// CLIENT SERVICES
export const getClientServices = async (clientId: string, query?: BaseQuery): Promise<PaginatedResponse<ClientService>> => {
  return getPaginated<ClientService>(`/clients/${clientId}/services/`, query);
};

export default apiClient;
