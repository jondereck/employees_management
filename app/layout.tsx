import './globals.css'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'

import ModalProvider from '@/components/provider/modal-provider'
import prismadb from '@/lib/prismadb'
import { ToastProvider } from '@/components/provider/toast-provider'
import { ToastProvider2 } from '@/components/provider/toast-provider2'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Admin Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <ClerkProvider>
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider/>
        <ModalProvider/>
        <ToastProvider2/>
        {children}
        </body>
    </html>
    </ClerkProvider>
  )
}
