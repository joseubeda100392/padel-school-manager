/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@padel/db', '@padel/types', '@padel/stripe'],
  experimental: {
    staleTimes: {
      dynamic: 120,
      static: 300,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
