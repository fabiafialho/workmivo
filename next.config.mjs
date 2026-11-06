/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/vendas.html' },
    ]
  },
}

export default nextConfig
