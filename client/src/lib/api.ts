import axios from 'axios';

import { LoginPayload, TokenResponse, RefreshPayload, AccessTokenResponse } from '@/types/api/auth';
import { PaginatedResponse } from '@/types/api/pagination';
import { User } from '@/types/api/users';
import { Company } from '@/types/api/companies';
import { BaseQuery } from '@/types/api/common';

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

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = getCookie('refresh');
        if (!refresh) {
          return Promise.reject(error);
        }

        const resp = await apiClient.post<AccessTokenResponse>('/token/refresh', { refresh });
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

export const login = async (payload: LoginPayload): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>('/token/', payload);
  return response.data;
};
export const refreshToken = async (payload: RefreshPayload): Promise<AccessTokenResponse> => {
  const response = await apiClient.post<AccessTokenResponse>('/token/refresh', payload);
  return response.data;
};

export const getUsers = async (query?: BaseQuery): Promise<PaginatedResponse<User>> => {
  return getPaginated<User>('/users/', query);
};
export const getUsersMe = async (): Promise<User> => {
  const response = await apiClient.get<User>('/users/me/');
  return response.data;
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

export const getCompanies = async (query?: BaseQuery): Promise<PaginatedResponse<Company>> => {
  return getPaginated<Company>('/companies/', query);
};
export const getCompaniesMe = async (): Promise<Company[]> => {
  const response = await apiClient.get<Company[]>('/companies/me/');
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

export default apiClient;
