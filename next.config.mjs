/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/vendas', destination: '/vendas.html' },
    ]
  },
}
export default nextConfig
