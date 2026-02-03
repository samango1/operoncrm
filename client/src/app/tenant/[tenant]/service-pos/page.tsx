import ServicePosPage from '@/components/Pages/ServicePosPage';

type TenantServicePosPageProps = {
  params: { tenant: string };
};

export default function TenantServicePosPage({ params }: TenantServicePosPageProps) {
  return <ServicePosPage tenantSlug={params.tenant} />;
}
