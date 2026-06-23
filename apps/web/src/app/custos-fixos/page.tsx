import { FixosClient } from '@/components/fixos-client';

// Página privada — toda a interação roda no cliente.
// (Protegida pelo middleware: o filtro startsWith('/custos') já cobre esta rota.)
export const dynamic = 'force-dynamic';

export default function CustosFixosPage() {
  return <FixosClient />;
}
