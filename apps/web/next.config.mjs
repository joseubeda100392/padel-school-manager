/** @type {import('next').NextConfig} */
const nextConfig = {
transpilePackages: ['@padel/db', '@padel/types', '@padel/stripe'],
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
