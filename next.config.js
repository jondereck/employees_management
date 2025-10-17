/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  disable: true, // ✅ disables built-in PWA
});



const nextConfig = {
  reactStrictMode: true, // Enable React strict mode for improved error handling
  swcMinify: true,      // Enable SWC minification for improved performance
  compiler: {
    removeConsole: process.env.NODE_ENV !== "development", // Remove console.log in production
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh6.googleusercontent.com' },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "drive.google.com" },
        { protocol: "https", hostname: "replicate.delivery" },


    ],
  },
  async redirects() {
    return [
      {
        source: "/:departmentId/biometrics",
        destination: "/:departmentId/tools/biometrics",
        permanent: true,
      },
      {
        source: "/:departmentId/billboards/:path*",
        destination: "/:departmentId/tools/covers/:path*",
        permanent: true,
      },
      {
        source: "/:departmentId/covers",
        destination: "/:departmentId/tools/covers",
        permanent: true,
      },
      {
        source: "/:departmentId/attendance/import",
        destination: "/:departmentId/tools/attendance-import",
        permanent: true,
      },
      {
        source: "/:departmentId/copy-options",
        destination: "/:departmentId/tools/copy-options",
        permanent: true,
      },
    ];
  },
}

module.exports = withPWA(nextConfig);
