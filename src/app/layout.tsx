import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'] })

export const metadata: Metadata = {
  title: 'Theo Dõi Tiến Độ Ban Hành VBQPPL | Sở Tư pháp Tỉnh An Giang',
  description: 'Hệ thống theo dõi tiến độ ban hành Văn bản Quy phạm Pháp luật năm 2026 - Sở Tư pháp Tỉnh An Giang',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
