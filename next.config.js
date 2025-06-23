/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],

  // Offline fallback page (optional)
  fallbacks: {
    document: '/offline.html',
  },

  runtimeCaching: [
    {
      urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\.(?:png|jpg|jpeg|webp|svg|gif)/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/hrps\.vercel\.app\/f622687f-79c6-.*\/view/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'view-page-cache',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/hrps\.vercel\.app\/f622687f-79c6-.*\/employees/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'employees-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 3 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/hrps\.vercel\.app\/_next\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV !== 'development',
  },
  images: {
    domains: ['res.cloudinary.com'],
  },
};

module.exports = withPWA(nextConfig);
