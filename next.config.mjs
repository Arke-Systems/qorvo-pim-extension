/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors https://app.contentstack.com https://*.contentstack.com 'self'" }
      ]
    }
  ]
};
export default nextConfig;
