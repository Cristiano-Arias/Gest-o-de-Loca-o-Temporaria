'use client';

import { clearToken } from '@/lib/auth';

// Botão de logout. É um botão (não um link) de propósito: links são
// pré-carregados pelo Next e disparariam o logout sozinhos.
export function LogoutButton() {
  function sair() {
    clearToken();
    window.location.href = '/entrar';
  }
  return (
    <button
      onClick={sair}
      className="text-xs text-[#bfe3e8] underline hover:text-white"
    >
      Sair
    </button>
  );
}
