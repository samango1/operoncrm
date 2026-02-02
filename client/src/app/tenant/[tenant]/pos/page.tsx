'use client';

import { useParams } from 'next/navigation';
import PosPage from '@/components/Pages/PosPage';

export default function TenantPosPage() {
  const params = useParams<{ tenant: string }>();
  const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;

  return <PosPage tenantSlug={tenantValue ? String(tenantValue) : undefined} />;
}
