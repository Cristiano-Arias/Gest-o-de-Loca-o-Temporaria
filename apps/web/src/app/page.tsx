import { redirect } from 'next/navigation';

// A raiz manda para o painel; o middleware decide se mostra o login.
export default function Home() {
  redirect('/painel');
}
