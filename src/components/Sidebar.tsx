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
    ChevronRight,
    Scale,
} from 'lucide-react'

interface DocCounts {
    nq_can: number
    nq_da: number
    qd_ubnd_can: number
    qd_ubnd_da: number
    qd_ct: number
}

// Thứ tự theo sheet Excel:
// 1. NQ can xu ly
// 2. QD UBND can xu ly
// 3. QD CT.UBND
// 4. NQ HDND da xu ly
// 5. QD UBND da xu ly
function buildNavItems(counts: DocCounts | null) {
    return [
        {
            label: 'Tổng quan',
            href: '/dashboard',
            icon: LayoutDashboard,
        },
        {
            label: 'NQ HĐND Cần Xử Lý',
            href: '/nq/can-xu-ly',
            icon: FileText,
            badgeLabel: 'NQ',
            badgeColor: 'bg-orange-100 text-orange-700',
            count: counts?.nq_can ?? null,
        },
        {
            label: 'QĐ UBND Cần Xử Lý',
            href: '/qd-ubnd/can-xu-ly',
            icon: FileText,
            badgeLabel: 'QĐ',
            badgeColor: 'bg-orange-100 text-orange-700',
            count: counts?.qd_ubnd_can ?? null,
        },
        {
            label: 'QĐ Chủ tịch UBND',
            href: '/qd-ct-ubnd',
            icon: Gavel,
            badgeLabel: 'CT',
            badgeColor: 'bg-purple-100 text-purple-700',
            count: counts?.qd_ct ?? null,
        },
        {
            label: 'NQ HĐND Đã xử lý',
            href: '/nq/da-xu-ly',
            icon: CheckSquare,
            badgeLabel: 'NQ',
            badgeColor: 'bg-green-100 text-green-700',
            count: counts?.nq_da ?? null,
        },
        {
            label: 'QĐ UBND Đã Xử Lý',
            href: '/qd-ubnd/da-xu-ly',
            icon: CheckSquare,
            badgeLabel: 'QĐ',
            badgeColor: 'bg-green-100 text-green-700',
            count: counts?.qd_ubnd_da ?? null,
        },
        { divider: true },
        {
            label: 'Báo cáo & Thống kê',
            href: '/reports',
            icon: BarChart3,
        },
        {
            label: 'Import dữ liệu',
            href: '/import',
            icon: Upload,
        },
        {
            label: 'Quản lý người dùng',
            href: '/admin/users',
            icon: Users,
        },
    ]
}

export default function Sidebar() {
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
        <aside className="w-64 min-h-screen bg-slate-900 flex flex-col border-r border-slate-700/50">
            {/* Logo */}
            <div className="px-4 py-5 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Scale className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm leading-tight">Theo Dõi VBQPPL</p>
                        <p className="text-slate-400 text-xs">Sở Tư pháp · An Giang</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {navItems.map((item, i) => {
                    if ('divider' in item && item.divider) {
                        return <div key={i} className="my-3 border-t border-slate-700/50" />
                    }
                    const navItem = item as {
                        label: string
                        href: string
                        icon: React.ElementType
                        badgeLabel?: string
                        badgeColor?: string
                        count?: number | null
                    }
                    const Icon = navItem.icon
                    const isActive = pathname === navItem.href ||
                        (navItem.href !== '/' && pathname.startsWith(navItem.href))
                    return (
                        <Link
                            key={navItem.href}
                            href={navItem.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            )}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 truncate">{navItem.label}</span>
                            {navItem.count !== undefined && navItem.count !== null && (
                                <span className={cn(
                                    'text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[1.5rem] text-center tabular-nums',
                                    navItem.badgeColor
                                )}>
                                    {navItem.count}
                                </span>
                            )}
                            {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 py-3 border-t border-slate-700/50">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                </button>
                <p className="text-slate-600 text-xs text-center mt-3">Năm 2026 · v1.0</p>
            </div>
        </aside>
    )
}
