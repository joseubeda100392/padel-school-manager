/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@padel/db', '@padel/types', '@padel/stripe'],
  // Disable static prerendering for all pages — app uses Supabase at runtime
  experimental: {
    missingSuspenseWithCSRBailout: false,
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
