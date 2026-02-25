'use client'

import Header from '@/components/Header'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <Header />
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
                <footer className="bg-slate-900 border-t border-slate-700/50 py-2 text-center">
                    <p className="text-slate-500 text-xs">
                        Sở Tư pháp tỉnh An Giang, Năm 2026 · v1.0
                    </p>
                </footer>
            </div>
        </ToastProvider>
    )
}
