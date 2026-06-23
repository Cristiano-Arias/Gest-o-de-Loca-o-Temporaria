import { AgendaClient } from '@/components/agenda-client';

// Página privada — toda a interação roda no cliente.
export const dynamic = 'force-dynamic';

export default function AgendaPage() {
  return <AgendaClient />;
}
