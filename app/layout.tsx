import './globals.css'

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'

import ModalProvider from '@/components/provider/modal-provider'
import prismadb from '@/lib/prismadb'
import { ToastProvider } from '@/components/provider/toast-provider'
import { ToastProvider2 } from '@/components/provider/toast-provider2'
import ServiceWorkerProvider from '@/components/provider/serviceworker-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HR Profiling System',
  description: 'Human Resource Profiling System',
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["nextjs", "nextjs13", "next13", "pwa", "next-pwa"],
  authors: [
    { name: "Jon Dereck D. Nifas" },
    {
      name: "Jon Dereck D. Nifas",
      url: "https://www.linkedin.com/in/jdnifas/",
    },
  ],
  icons: [
    { rel: "apple-touch-icon", url: "icons/icon-128x128.png" },
    { rel: "icon", url: "icons/icon-128x128.png" },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#fff" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {


  return (
    <ClerkProvider>
    <html lang="en">
      <body className={inter.className}>
      <ModalProvider/>
        <ToastProvider/>
        <ToastProvider2/>
        <ServiceWorkerProvider />
        {children}
        </body>
    </html>
    </ClerkProvider>
  )
}
