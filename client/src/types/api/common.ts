export type UUID = string;

export interface BaseQuery {
  page?: number;
  page_size?: number;
  deep?: boolean;
  search?: string;
}

export interface Error {
  detail: string;
}
