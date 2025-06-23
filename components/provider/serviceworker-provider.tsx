"use client";

import { useEffect } from 'react';

const ServiceWorkerProvider = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js?v=2').then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        }).catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
      });
    }
  }, []);

  return null;
};

export default ServiceWorkerProvider;