/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone: gera .next/standalone com server.js próprio p/ o Docker do
  // VPS (docker-compose.prod.yml). Na Vercel a opção é ignorada sem dano.
  output: 'standalone',
};

export default nextConfig;
