import { PlataformasClient } from '@/components/plataformas-client';

// Página privada — os KPIs por canal são calculados no cliente.
export const dynamic = 'force-dynamic';

export default function PlataformasPage() {
  return <PlataformasClient />;
}
