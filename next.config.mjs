/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pchilka-market.ua'
      },
      {
        protocol: 'https',
        hostname: 'www.pchilka-market.ua'
      }
    ]
  }
};

export default nextConfig;
