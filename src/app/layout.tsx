import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Theo Dõi Tiến Độ Ban Hành VBQPPL | Sở Tư pháp Tỉnh An Giang',
  description: 'Hệ thống theo dõi tiến độ ban hành Văn bản Quy phạm Pháp luật năm 2026 - Sở Tư pháp Tỉnh An Giang',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
