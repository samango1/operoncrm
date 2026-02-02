'use client';

import { useParams } from 'next/navigation';
import ProductsPage from '@/components/Pages/ProductsPage';

export default function TenantProductsPage() {
  const params = useParams<{ tenant: string }>();
  const tenantValue = Array.isArray(params?.tenant) ? params?.tenant?.[0] : params?.tenant;

  return <ProductsPage tenantSlug={tenantValue ? String(tenantValue) : undefined} />;
}
