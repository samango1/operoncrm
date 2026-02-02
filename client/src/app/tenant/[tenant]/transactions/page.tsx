'use client';

import { useParams } from 'next/navigation';
import TransactionsPage from '@/components/Pages/TransactionsPage';

export default function TenantTransactionsPage() {
  const params = useParams<{ tenant: string }>();
  const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;

  return <TransactionsPage tenantSlug={tenantValue ? String(tenantValue) : undefined} />;
}
