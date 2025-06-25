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
    domains: [
      "res.cloudinary.com"
    ]
  }
}

module.exports = withPWA(nextConfig);
