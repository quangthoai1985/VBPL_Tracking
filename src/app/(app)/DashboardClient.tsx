'use client'

import { useState, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Legend,
} from 'recharts'
import { FileText, CheckSquare, Layers, TrendingUp, RefreshCw } from 'lucide-react'
import { DocType } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface DocData {
    id: string
    doc_type: DocType
    status: string
    handler_name: string | null
    agency_name: string | null
    // New columns
    doc_category: string
    count_tt_thay_the: number
    count_tt_bai_bo: number
    count_tt_khong_xu_ly: number
    count_tt_het_hieu_luc: number
    count_vm_ban_hanh_moi: number
    count_vm_sua_doi_bo_sung: number
    count_vm_thay_the: number
    count_vm_bai_bo: number
    // Legacy
    count_thay_the: number
    count_bai_bo: number
    count_ban_hanh_moi: number
    count_chua_xac_dinh: number
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#6b7280', '#14b8a6', '#ec4899']

// =====================================================
// MAPPING: Agency → Lĩnh vực (theo sheet "Tong Hop Chung")
// =====================================================

interface LinhVucConfig {
    tt: number
    name: string
    agencies: string[]
    handler: string
}

// 1. Đối với 243 Nghị quyết HĐND
const NQ_LINH_VUC: LinhVucConfig[] = [
    { tt: 1, name: 'Lĩnh vực an ninh chính trị, trật tự an toàn xã hội', agencies: ['Công an tỉnh', 'Bộ Chỉ huy Quân sự tỉnh'], handler: 'Thảo' },
    { tt: 2, name: 'Lĩnh vực tư pháp', agencies: ['Sở Tư pháp'], handler: 'Nhung, Trâm' },
    { tt: 3, name: 'Lĩnh vực y tế', agencies: ['Sở Y tế'], handler: 'Nhung' },
    { tt: 4, name: 'Lĩnh vực xây dựng', agencies: ['Sở Xây dựng'], handler: 'Đỗ Hằng' },
    { tt: 5, name: 'Lĩnh vực nông nghiệp và môi trường', agencies: ['Sở Nông nghiệp và Môi trường'], handler: 'Trâm' },
    { tt: 6, name: 'Lĩnh vực tài chính', agencies: ['Sở Tài chính', 'Chi nhánh Ngân hàng chính sách xã hội tỉnh An Giang'], handler: 'Thảo' },
    { tt: 7, name: 'Lĩnh vực nội vụ', agencies: ['Sở Nội vụ'], handler: 'Nhung' },
    { tt: 8, name: 'Lĩnh vực công thương', agencies: ['Sở Công Thương'], handler: 'Đỗ Hằng' },
    { tt: 9, name: 'Lĩnh vực dân tộc và tôn giáo', agencies: ['Sở Dân tộc và Tôn giáo'], handler: 'Loan' },
    { tt: 10, name: 'Lĩnh vực văn hóa, thể thao và du lịch', agencies: ['Sở Văn hóa và Thể thao', 'Sở Du lịch'], handler: 'Loan' },
    { tt: 11, name: 'Lĩnh vực giáo dục và đào tạo', agencies: ['Sở Giáo dục và Đào tạo'], handler: 'Loan' },
    { tt: 12, name: 'Lĩnh vực pháp chế', agencies: ['Ban của Hội đồng nhân dân tỉnh'], handler: 'Thảo' },
    { tt: 13, name: 'Lĩnh vực thanh tra', agencies: ['Thanh tra tỉnh'], handler: 'Nhung' },
    { tt: 14, name: 'Lĩnh vực khoa học và công nghệ', agencies: ['Sở Khoa học và Công nghệ'], handler: 'Trâm' },
]

// 2. Đối với 322 Quyết định UBND
const QD_LINH_VUC: LinhVucConfig[] = [
    { tt: 1, name: 'Lĩnh vực Văn phòng UBND tỉnh', agencies: ['Văn phòng UBND tỉnh'], handler: 'Thảo' },
    { tt: 2, name: 'Lĩnh vực nội vụ', agencies: ['Sở Nội vụ'], handler: 'Nhung' },
    { tt: 3, name: 'Lĩnh vực tư pháp', agencies: ['Sở Tư pháp'], handler: 'Nhung' },
    { tt: 4, name: 'Lĩnh vực tài chính', agencies: ['Sở Tài chính'], handler: 'Thảo' },
    { tt: 5, name: 'Lĩnh vực văn hóa, thể thao', agencies: ['Sở Văn hóa và Thể thao'], handler: 'Loan' },
    { tt: 6, name: 'Lĩnh vực du lịch', agencies: ['Sở Du lịch'], handler: 'Loan' },
    { tt: 7, name: 'Lĩnh vực y tế', agencies: ['Sở Y tế'], handler: 'Nhung' },
    { tt: 8, name: 'Lĩnh vực công thương', agencies: ['Sở Công Thương'], handler: 'Thanh Hằng' },
    { tt: 9, name: 'Lĩnh vực an ninh chính trị, trật tự an toàn xã hội', agencies: ['Công an tỉnh', 'Bộ Chỉ huy Quân sự tỉnh'], handler: 'Thảo' },
    { tt: 10, name: 'Lĩnh vực giáo dục và đào tạo', agencies: ['Sở Giáo dục và Đào tạo'], handler: 'Loan' },
    { tt: 11, name: 'Lĩnh vực xây dựng', agencies: ['Sở Xây dựng'], handler: 'Thanh Hằng' },
    { tt: 12, name: 'Lĩnh vực khoa học và công nghệ', agencies: ['Sở Khoa học và Công nghệ'], handler: 'Trâm' },
    { tt: 13, name: 'Lĩnh vực nông nghiệp và môi trường', agencies: ['Sở Nông nghiệp và Môi trường', 'Chưa xác định/Sở NNMT'], handler: 'Trâm' },
    { tt: 14, name: 'Ban Quản lý Khu kinh tế tỉnh', agencies: ['Ban Quản lý Khu kinh tế'], handler: 'Thanh Hằng' },
]

// =====================================================

interface LinhVucRow {
    tt: number
    name: string
    handler: string
    can_xu_ly: number
    bai_bo_khong_xl: number
    ban_hanh_moi_thay_the: number
}

function computeLinhVucTable(
    docs: DocData[],
    docType: DocType,
    linhVucList: LinhVucConfig[]
): LinhVucRow[] {
    const typeDocs = docs.filter(d => d.doc_type === docType)

    return linhVucList.map(lv => {
        const agencySet = new Set(lv.agencies.map(a => a.toLowerCase()))

        const matchDocs = typeDocs.filter(d =>
            d.agency_name && agencySet.has(d.agency_name.toLowerCase())
        )

        const canXuLy = matchDocs.filter(d => d.status === 'can_xu_ly').length
        const daXuLyDocs = matchDocs.filter(d => d.status === 'da_xu_ly')

        // Tính "Bãi bỏ / Không xử lý": nhóm VB tiếp tục (bãi bỏ + không XL + hết hiệu lực)
        const baiBo = daXuLyDocs.reduce((sum, d) => {
            const newVal = (Number(d.count_tt_bai_bo) || 0)
                + (Number(d.count_tt_khong_xu_ly) || 0)
                + (Number(d.count_tt_het_hieu_luc) || 0)
                + (Number(d.count_vm_bai_bo) || 0)
            // Fallback to legacy
            const legacyVal = (Number(d.count_bai_bo) || 0)
            return sum + (newVal > 0 ? newVal : legacyVal)
        }, 0)

        // Tính "Ban hành mới, thay thế": nhóm VB mới (ban hành mới + sửa đổi BS + thay thế) + nhóm VB tiếp tục (thay thế)
        const banHanh = daXuLyDocs.reduce((sum, d) => {
            const newVal = (Number(d.count_tt_thay_the) || 0)
                + (Number(d.count_vm_ban_hanh_moi) || 0)
                + (Number(d.count_vm_sua_doi_bo_sung) || 0)
                + (Number(d.count_vm_thay_the) || 0)
            // Fallback to legacy
            const legacyVal = (Number(d.count_ban_hanh_moi) || 0) + (Number(d.count_thay_the) || 0)
            return sum + (newVal > 0 ? newVal : legacyVal)
        }, 0)

        return {
            tt: lv.tt,
            name: lv.name,
            handler: lv.handler,
            can_xu_ly: canXuLy,
            bai_bo_khong_xl: baiBo,
            ban_hanh_moi_thay_the: banHanh,
        }
    })
}

// =====================================================
// COMPONENT
// =====================================================
export default function DashboardClient() {
    const [docs, setDocs] = useState<DocData[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: rawDocs } = await supabase
                .from('documents')
                .select('id, doc_type, status, handler_name, agency_id, doc_category, count_tt_thay_the, count_tt_bai_bo, count_tt_khong_xu_ly, count_tt_het_hieu_luc, count_vm_ban_hanh_moi, count_vm_sua_doi_bo_sung, count_vm_thay_the, count_vm_bai_bo, count_thay_the, count_bai_bo, count_ban_hanh_moi, count_chua_xac_dinh')

            const { data: rawAgencies } = await supabase
                .from('agencies')
                .select('id, name')

            const agencyMap: Record<number, string> = {}
            for (const a of (rawAgencies || [])) {
                agencyMap[a.id] = a.name
            }

            const merged: DocData[] = (rawDocs || []).map((d: any) => ({
                ...d,
                agency_name: d.agency_id ? (agencyMap[d.agency_id] ?? null) : null,
            }))

            setDocs(merged)
        } catch (err) {
            console.error('Error fetching dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Compute tables
    const nqTable = computeLinhVucTable(docs, 'NQ', NQ_LINH_VUC)
    const qdTable = computeLinhVucTable(docs, 'QD_UBND', QD_LINH_VUC)

    // Totals
    const nqTotalCanXL = nqTable.reduce((s, r) => s + r.can_xu_ly, 0)
    const nqTotalBaiBo = nqTable.reduce((s, r) => s + r.bai_bo_khong_xl, 0)
    const nqTotalBanHanh = nqTable.reduce((s, r) => s + r.ban_hanh_moi_thay_the, 0)
    const nqTotalDaXuLy = nqTotalBaiBo + nqTotalBanHanh

    const qdTotalCanXL = qdTable.reduce((s, r) => s + r.can_xu_ly, 0)
    const qdTotalBaiBo = qdTable.reduce((s, r) => s + r.bai_bo_khong_xl, 0)
    const qdTotalBanHanh = qdTable.reduce((s, r) => s + r.ban_hanh_moi_thay_the, 0)
    const qdTotalDaXuLy = qdTotalBaiBo + qdTotalBanHanh

    const totalCanXuLy = nqTotalCanXL + qdTotalCanXL
    const totalDaXuLy = nqTotalDaXuLy + qdTotalDaXuLy
    const total = totalCanXuLy + totalDaXuLy
    const progressPct = total > 0 ? Math.round((totalDaXuLy / total) * 100) : 0

    // Thống kê hình thức xử lý theo 2 nhóm
    const sumField = (arr: DocData[], field: keyof DocData) => arr.reduce((acc, d) => acc + (Number(d[field]) || 0), 0)

    const ttThayThe = sumField(docs, 'count_tt_thay_the')
    const ttBaiBo = sumField(docs, 'count_tt_bai_bo')
    const ttKhongXuLy = sumField(docs, 'count_tt_khong_xu_ly')
    const ttHetHieuLuc = sumField(docs, 'count_tt_het_hieu_luc')
    const ttTotal = ttThayThe + ttBaiBo + ttKhongXuLy + ttHetHieuLuc

    const vmBanHanhMoi = sumField(docs, 'count_vm_ban_hanh_moi')
    const vmSuaDoiBS = sumField(docs, 'count_vm_sua_doi_bo_sung')
    const vmThayThe = sumField(docs, 'count_vm_thay_the')
    const vmBaiBo = sumField(docs, 'count_vm_bai_bo')
    const vmTotal = vmBanHanhMoi + vmSuaDoiBS + vmThayThe + vmBaiBo

    // Bar chart: theo chuyên viên
    const handlerMap: Record<string, { name: string; can_xu_ly: number; da_xu_ly: number }> = {}
    docs.forEach(d => {
        const handler = d.handler_name || 'Chưa phân công'
        if (!handlerMap[handler]) handlerMap[handler] = { name: handler, can_xu_ly: 0, da_xu_ly: 0 }
        if (d.status === 'can_xu_ly') handlerMap[handler].can_xu_ly++
        if (d.status === 'da_xu_ly') handlerMap[handler].da_xu_ly++
    })
    const handlerBarData = Object.values(handlerMap).sort((a, b) => (b.can_xu_ly + b.da_xu_ly) - (a.can_xu_ly + a.da_xu_ly))

    // Cards
    const cards = [
        {
            label: 'Tổng VB cần xử lý',
            value: totalCanXuLy.toLocaleString(),
            icon: FileText,
            color: 'from-orange-500 to-orange-600',
            sub: `NQ: ${nqTotalCanXL} · QĐ UBND: ${qdTotalCanXL}`,
        },
        {
            label: 'Tổng VB đã xử lý',
            value: totalDaXuLy.toLocaleString(),
            icon: CheckSquare,
            color: 'from-green-500 to-green-600',
            sub: `NQ: ${nqTotalDaXuLy} · QĐ UBND: ${qdTotalDaXuLy}`,
        },
        {
            label: 'Tổng văn bản',
            value: total.toLocaleString(),
            icon: Layers,
            color: 'from-blue-500 to-blue-600',
            sub: 'Năm 2026 – Tỉnh An Giang',
        },
        {
            label: 'Tiến độ hoàn thành',
            value: `${progressPct}%`,
            icon: TrendingUp,
            color: 'from-purple-500 to-purple-600',
            sub: `${totalDaXuLy}/${total} văn bản đã xử lý`,
        },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-slate-500 text-lg">Đang tải dữ liệu...</span>
            </div>
        )
    }

    return (
        <div className="w-full h-full overflow-y-auto bg-slate-50">
            <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Tổng Hợp Chung</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Báo cáo và phương hướng xử lý các Nghị quyết, Quyết định do HĐND, UBND tỉnh An Giang ban hành
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {cards.map((card) => {
                        const Icon = card.icon
                        return (
                            <div key={card.label}
                                className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className={`h-1.5 bg-gradient-to-r ${card.color}`} />
                                <div className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-slate-500 text-sm font-medium">{card.label}</p>
                                            <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
                                            <p className="text-slate-400 text-xs mt-1.5">{card.sub}</p>
                                        </div>
                                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                                            <Icon className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ====== THỐNG KÊ HÌNH THỨC XỬ LÝ ====== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Nhóm 1: Văn bản tiếp tục áp dụng */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden border-t-4 border-indigo-500">
                        <div className="px-5 py-4 bg-indigo-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-white" />
                                </div>
                                <h2 className="font-bold text-base text-indigo-800">Văn bản tiếp tục áp dụng</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-indigo-700">{ttTotal}</p>
                                <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Tổng cộng</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <StatRow label="Thay thế" value={ttThayThe} total={ttTotal} color="bg-blue-500" />
                            <StatRow label="Bãi bỏ" value={ttBaiBo} total={ttTotal} color="bg-red-500" />
                            <StatRow label="Không xử lý" value={ttKhongXuLy} total={ttTotal} color="bg-slate-400" />
                            <StatRow label="Hết hiệu lực theo thời gian" value={ttHetHieuLuc} total={ttTotal} color="bg-purple-500" />
                        </div>
                    </div>

                    {/* Nhóm 2: Văn bản mới */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden border-t-4 border-emerald-500">
                        <div className="px-5 py-4 bg-emerald-50/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                    <Layers className="w-4 h-4 text-white" />
                                </div>
                                <h2 className="font-bold text-base text-emerald-800">Văn bản mới</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-emerald-700">{vmTotal}</p>
                                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Tổng cộng</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-3">
                            <StatRow label="Ban hành mới" value={vmBanHanhMoi} total={vmTotal} color="bg-green-500" />
                            <StatRow label="Sửa đổi bổ sung" value={vmSuaDoiBS} total={vmTotal} color="bg-teal-500" />
                            <StatRow label="Thay thế" value={vmThayThe} total={vmTotal} color="bg-blue-500" />
                            <StatRow label="Bãi bỏ" value={vmBaiBo} total={vmTotal} color="bg-red-500" />
                        </div>
                    </div>
                </div>

                {/* ====== BAR CHART: Chuyên viên ====== */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                    <h2 className="font-semibold text-slate-700 mb-4">Tiến Độ Theo Chuyên Viên</h2>
                    {handlerBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={handlerBarData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend iconType="circle" iconSize={8} />
                                <Bar dataKey="can_xu_ly" name="Cần xử lý" fill="#f97316" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="da_xu_ly" name="Đã xử lý" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
                            Chưa có dữ liệu
                        </div>
                    )}
                </div>

                {/* ====== TABLE 1: NQ HĐND ====== */}
                <SummaryTable
                    title="1. Đối với 243 Nghị quyết của Hội đồng nhân dân tỉnh"
                    data={nqTable}
                    totalCanXL={nqTotalCanXL}
                    totalBaiBo={nqTotalBaiBo}
                    totalBanHanh={nqTotalBanHanh}
                    accentColor="blue"
                />

                {/* ====== TABLE 2: QĐ UBND ====== */}
                <SummaryTable
                    title="2. Đối với 322 Quyết định của Ủy ban nhân dân tỉnh"
                    data={qdTable}
                    totalCanXL={qdTotalCanXL}
                    totalBaiBo={qdTotalBaiBo}
                    totalBanHanh={qdTotalBanHanh}
                    accentColor="emerald"
                />


            </div>
        </div>
    )
}

// =====================================================
// SUB-COMPONENT: StatRow (progress bar cho thống kê)
// =====================================================
function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    return (
        <div className="flex items-center gap-3">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
            <span className="text-sm text-slate-600 w-48 shrink-0">{label}</span>
            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-500', color)}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-sm font-bold text-slate-800 w-10 text-right">{value}</span>
            <span className="text-[10px] text-slate-400 w-10 text-right">{pct}%</span>
        </div>
    )
}

// =====================================================
// SUB-COMPONENT: Summary Table
// =====================================================
function SummaryTable({
    title,
    data,
    totalCanXL,
    totalBaiBo,
    totalBanHanh,
    accentColor,
}: {
    title: string
    data: LinhVucRow[]
    totalCanXL: number
    totalBaiBo: number
    totalBanHanh: number
    accentColor: 'blue' | 'emerald'
}) {
    const borderTop = accentColor === 'blue' ? 'border-blue-500' : 'border-emerald-500'
    const headerBg = accentColor === 'blue' ? 'bg-blue-50/80' : 'bg-emerald-50/80'
    const titleColor = accentColor === 'blue' ? 'text-blue-800' : 'text-emerald-800'

    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden border-t-4 ${borderTop}`}>
            <div className={`px-5 py-4 ${headerBg}`}>
                <h2 className={`font-bold text-base ${titleColor}`}>{title}</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200">
                        <tr>
                            <th rowSpan={2} className="px-3 py-3 border-r border-slate-200 bg-slate-100/50 w-12 text-center text-slate-500">TT</th>
                            <th rowSpan={2} className="px-4 py-3 border-r border-slate-200 bg-slate-100/50 text-slate-700">Lĩnh vực</th>
                            <th rowSpan={2} className="px-3 py-3 border-r border-slate-200 bg-slate-100/50 text-center w-28 whitespace-nowrap text-slate-700">
                                Số VB còn<br />phải xử lý
                            </th>
                            <th colSpan={2} className="px-3 py-2 border-r border-b border-slate-200 bg-slate-100/50 text-center text-slate-700">
                                Số văn bản đã xử lý
                            </th>
                            <th rowSpan={2} className="px-3 py-3 bg-slate-100/50 w-44 text-slate-700">
                                Chuyên viên<br />phụ trách
                            </th>
                        </tr>
                        <tr>
                            <th className="px-3 py-2 border-r border-slate-200 bg-slate-50 text-center w-28 font-medium text-slate-600">
                                Bãi bỏ /<br />Không xử lý
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 bg-slate-50 text-center w-28 font-medium text-slate-600">
                                Ban hành mới,<br />thay thế
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((row) => (
                            <tr key={row.tt} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-3 py-2.5 border-r border-slate-100 text-center text-slate-500 font-medium">
                                    {String(row.tt).padStart(2, '0')}
                                </td>
                                <td className="px-4 py-2.5 border-r border-slate-100 font-medium text-slate-700">
                                    {row.name}
                                </td>
                                <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                                    {row.can_xu_ly > 0 ? (
                                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full bg-orange-100 text-orange-700 font-bold text-xs">
                                            {row.can_xu_ly}
                                        </span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                                    {row.bai_bo_khong_xl > 0 ? (
                                        <span className="font-semibold text-slate-600">{row.bai_bo_khong_xl}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                                    {row.ban_hanh_moi_thay_the > 0 ? (
                                        <span className="font-semibold text-slate-600">{row.ban_hanh_moi_thay_the}</span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 text-xs">
                                    {row.handler}
                                </td>
                            </tr>
                        ))}
                        {/* Tổng cộng */}
                        <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200 text-slate-800">
                            <td colSpan={2} className="px-4 py-3 border-r border-slate-200 text-right uppercase text-sm">
                                TỔNG CỘNG
                            </td>
                            <td className="px-3 py-3 border-r border-slate-200 text-center text-orange-600 text-lg">
                                {totalCanXL}
                            </td>
                            <td className="px-3 py-3 border-r border-slate-200 text-center text-slate-700 text-lg">
                                {totalBaiBo}
                            </td>
                            <td className="px-3 py-3 border-r border-slate-200 text-center text-slate-700 text-lg">
                                {totalBanHanh}
                            </td>
                            <td className="px-3 py-3"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
