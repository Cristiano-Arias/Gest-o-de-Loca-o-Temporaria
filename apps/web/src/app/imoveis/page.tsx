import { ImoveisClient } from '@/components/imoveis-client';

// Página privada — toda a interação (lista, formulário, salvar) roda no cliente.
export const dynamic = 'force-dynamic';

export default function ImoveisPage() {
  return <ImoveisClient />;
}
