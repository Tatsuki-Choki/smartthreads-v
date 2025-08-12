import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/auth-context'
import { ReactQueryProvider } from '@/lib/react-query/provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SmartThreads - Threads自動運用ツール',
  description: 'Threadsの投稿を自動化し、効率的な運用を実現するツール',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ReactQueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}