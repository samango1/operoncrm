'use client';

import { useParams } from 'next/navigation';
import ClientsPage from '@/components/Pages/ClientsPage';

export default function TenantClientsPage() {
  const params = useParams<{ tenant: string }>();
  const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;

  return <ClientsPage tenantSlug={tenantValue ? String(tenantValue) : undefined} />;
}
