'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
    LayoutDashboard,
    FileText,
    CheckSquare,
    Gavel,
    BarChart3,
    Upload,
    Users,
    LogOut,
    Scale,
} from 'lucide-react'

interface DocCounts {
    nq_can: number
    nq_da: number
    qd_ubnd_can: number
    qd_ubnd_da: number
    qd_ct: number
}

function buildNavItems(counts: DocCounts | null) {
    return [
        {
            label: 'Tổng quan',
            href: '/dashboard',
            icon: LayoutDashboard,
        },
        {
            label: 'NQ Cần Xử Lý',
            href: '/nq/can-xu-ly',
            icon: FileText,
            badgeLabel: 'NQ',
            pills: 'NQ',
            count: counts?.nq_can ?? null,
        },
        {
            label: 'QĐ UBND Cần Xử Lý',
            href: '/qd-ubnd/can-xu-ly',
            icon: FileText,
            badgeLabel: 'QĐ',
            pills: 'QĐ',
            count: counts?.qd_ubnd_can ?? null,
        },
        {
            label: 'QĐ Chủ tịch UBND',
            href: '/qd-ct-ubnd',
            icon: Gavel,
            badgeLabel: 'CT',
            pills: 'CT',
            count: counts?.qd_ct ?? null,
        },
        {
            label: 'NQ HĐND Đã xử lý',
            href: '/nq/da-xu-ly',
            icon: CheckSquare,
            badgeLabel: 'NQ',
            pills: 'NQ_DA',
            count: counts?.nq_da ?? null,
        },
        {
            label: 'QĐ UBND Đã Xử Lý',
            href: '/qd-ubnd/da-xu-ly',
            icon: CheckSquare,
            badgeLabel: 'QĐ',
            pills: 'QĐ_DA',
            count: counts?.qd_ubnd_da ?? null,
        },
        { divider: true },
        {
            label: 'Báo cáo',
            href: '/reports',
            icon: BarChart3,
        },
        {
            label: 'Import',
            href: '/import',
            icon: Upload,
        },
        {
            label: 'Người dùng',
            href: '/admin/users',
            icon: Users,
        },
    ]
}

export default function Header() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [counts, setCounts] = useState<DocCounts | null>(null)

    useEffect(() => {
        async function fetchCounts() {
            const [nqCan, nqDa, qdUbndCan, qdUbndDa, qdCt] = await Promise.all([
                supabase.from('documents').select('*', { count: 'exact', head: true })
                    .eq('doc_type', 'NQ').eq('status', 'can_xu_ly'),
                supabase.from('documents').select('*', { count: 'exact', head: true })
                    .eq('doc_type', 'NQ').eq('status', 'da_xu_ly'),
                supabase.from('documents').select('*', { count: 'exact', head: true })
                    .eq('doc_type', 'QD_UBND').eq('status', 'can_xu_ly'),
                supabase.from('documents').select('*', { count: 'exact', head: true })
                    .eq('doc_type', 'QD_UBND').eq('status', 'da_xu_ly'),
                supabase.from('documents').select('*', { count: 'exact', head: true })
                    .eq('doc_type', 'QD_CT_UBND'),
            ])

            setCounts({
                nq_can: nqCan.count ?? 0,
                nq_da: nqDa.count ?? 0,
                qd_ubnd_can: qdUbndCan.count ?? 0,
                qd_ubnd_da: qdUbndDa.count ?? 0,
                qd_ct: qdCt.count ?? 0,
            })
        }
        fetchCounts()
    }, [])

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const navItems = buildNavItems(counts)

    return (
        <header className="bg-slate-900 border-b border-slate-700/50 sticky top-0 z-50 h-14 overflow-hidden">
            <div className="flex items-stretch h-full max-w-[100vw]">
                {/* Logo */}
                <div className="flex items-center gap-2.5 px-4 border-r border-slate-700/50 shrink-0 h-full">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Scale className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="leading-tight">
                        <p className="font-bold text-white text-sm">Theo Dõi VBQPPL</p>
                        <p className="text-slate-400 text-[11px]">Sở Tư pháp · An Giang</p>
                    </div>
                </div>

                {/* Tabs nav */}
                <nav className="flex items-stretch flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide px-1 h-full">
                    {navItems.map((item, i) => {
                        if ('divider' in item && item.divider) {
                            return (
                                <div key={i} className="flex items-center px-1">
                                    <div className="w-px h-6 bg-slate-700/50" />
                                </div>
                            )
                        }
                        const navItem = item as {
                            label: string
                            href: string
                            icon: React.ElementType
                            pills?: string
                            count?: number | null
                        }
                        const Icon = navItem.icon
                        const isActive =
                            pathname === navItem.href ||
                            (navItem.href !== '/' && pathname.startsWith(navItem.href))

                        let badgeBg = 'bg-slate-800 text-slate-400'
                        if (navItem.pills === 'NQ' || navItem.pills === 'QĐ') badgeBg = 'bg-orange-500/10 text-orange-500'
                        if (navItem.pills === 'CT') badgeBg = 'bg-purple-500/10 text-purple-500'
                        if (navItem.pills === 'NQ_DA' || navItem.pills === 'QĐ_DA') badgeBg = 'bg-green-500/10 text-green-500'

                        return (
                            <Link
                                key={navItem.href}
                                href={navItem.href}
                                className={cn(
                                    'relative flex items-center gap-1.5 px-3 text-sm font-medium transition-all whitespace-nowrap h-full group',
                                    isActive
                                        ? 'text-white bg-slate-800/60'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                                )}
                            >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{navItem.label}</span>
                                {navItem.count !== undefined && navItem.count !== null && (
                                    <span className={cn(
                                        'text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[1.25rem] text-center tabular-nums',
                                        badgeBg
                                    )}>
                                        {navItem.count}
                                    </span>
                                )}
                                {isActive && (
                                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Logout */}
                <div className="flex items-center px-3 border-l border-slate-700/50 shrink-0 h-full">
                    <button
                        onClick={handleLogout}
                        title="Đăng xuất"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline text-[13px]">Đăng xuất</span>
                    </button>
                </div>
            </div>
        </header>
    )
}
