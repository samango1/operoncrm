'use client';

import { useParams } from 'next/navigation';
import StatisticsPage from '@/components/Pages/StatisticsPage';

export default function TenantStatisticsPage() {
  const params = useParams<{ tenant: string }>();
  const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;

  return <StatisticsPage tenantSlug={tenantValue ? String(tenantValue) : undefined} />;
}
