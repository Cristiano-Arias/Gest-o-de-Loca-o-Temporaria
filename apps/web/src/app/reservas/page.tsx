import { ReservasClient } from '@/components/reservas-client';

// Página privada — toda a interação roda no cliente.
export const dynamic = 'force-dynamic';

export default function ReservasPage() {
  return <ReservasClient />;
}
