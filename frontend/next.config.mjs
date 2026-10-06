/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: []
  },
  async redirects() {
    return [
      {
        source: '/tournament',
        destination: '/tournaments',
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: 'upgrade-insecure-requests; block-all-mixed-content' }
        ]
      }
    ];
  }
};

export default nextConfig;
