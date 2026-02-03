import ServiceDeliveriesPage from '@/components/Pages/ServiceDeliveriesPage';

type TenantServiceDeliveriesPageProps = {
  params: { tenant: string };
};

export default function TenantServiceDeliveriesPage({ params }: TenantServiceDeliveriesPageProps) {
  return <ServiceDeliveriesPage tenantSlug={params.tenant} />;
}
