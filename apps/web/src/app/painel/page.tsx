import { PainelClient } from '@/components/painel-client';

// Página privada — o painel calcula os números no cliente.
export const dynamic = 'force-dynamic';

export default function PainelPage() {
  return <PainelClient />;
}
