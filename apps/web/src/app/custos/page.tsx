import { CustosClient } from '@/components/custos-client';

// Página privada — toda a interação roda no cliente.
export const dynamic = 'force-dynamic';

export default function CustosPage() {
  return <CustosClient />;
}
