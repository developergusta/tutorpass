import { SetMetadata } from '@nestjs/common';

// Marca rota pública (sem autenticação) — lido pelo JwtAuthGuard. O padrão do
// projeto é "tudo autenticado por padrão": só login/refresh/logout/register
// carregam @Public; esquecer o decorator numa rota nova a deixa protegida,
// nunca exposta.
export const IS_PUBLIC_KEY = 'tutorpass:public';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
