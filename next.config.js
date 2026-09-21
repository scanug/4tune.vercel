/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/hub', destination: '/', permanent: true }];
  },
};

module.exports = nextConfig;
