import { Client } from '@/types/api/clients';
import { Service } from '@/types/api/services';

export type ClientServiceStatus = 'active' | 'expired';

export interface ClientService {
  id: string;
  client: Client | string;
  service: Service | string;
  transaction?: string | null;
  starts_at: string;
  ends_at?: string | null;
  status: ClientServiceStatus;
  created_at?: string;
  updated_at?: string;
}
