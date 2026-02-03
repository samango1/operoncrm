import ServicesPage from '@/components/Pages/ServicesPage';

type TenantServicesPageProps = {
  params: { tenant: string };
};

export default function TenantServicesPage({ params }: TenantServicesPageProps) {
  return <ServicesPage tenantSlug={params.tenant} />;
}
