/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'pchilka-market.ua'
      },
      {
        protocol: 'https',
        hostname: 'pchilka-market.ua'
      },
      {
        protocol: 'http',
        hostname: 'www.pchilka-market.ua'
      },
      {
        protocol: 'https',
        hostname: 'www.pchilka-market.ua'
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/admin/banners',
        destination: '/admin/home-slides'
      },
      {
        source: '/api/admin/banners',
        destination: '/api/admin/home-slides'
      }
    ];
  }
};

export default nextConfig;
