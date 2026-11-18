/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone: gera .next/standalone com server.js próprio p/ o Docker do
  // VPS (Linux). No Windows sem privilégio de symlink, o copyTracedFiles do
  // standalone falha com EPERM no fim do build; ativamos fora do win32 (ou
  // quando NEXT_STANDALONE=1 for passado explicitamente).
  output:
    process.platform === 'win32' && process.env.NEXT_STANDALONE !== '1'
      ? undefined
      : 'standalone',
};

export default nextConfig;
