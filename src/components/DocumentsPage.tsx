'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Document, DocType, Status, Agency,
    PROCESSING_FORM_LABELS, PROCESSING_FORM_COLORS,
    HANDLER_NAMES,
} from '@/lib/types'
import { cn, truncate } from '@/lib/utils'
import { Search, RefreshCw, Plus, Download, ChevronUp, ChevronDown, Trash2, Loader2 } from 'lucide-react'
import AddDocumentModal from './AddDocumentModal'
import ConfirmModal from './ConfirmModal'
import { useToast } from './Toast'

interface Props {
    docType: DocType
    status: Status
    title: string
    description: string
}

const PAGE_SIZE = 50

type SortField = 'stt' | 'name' | 'handler_name' | 'updated_at' | 'expected_date'
type SortDir = 'asc' | 'desc'

interface DocStats {
    thayThe: number
    baiBo: number
    banHanhMoi: number
    chuaXacDinh: number
    handlers: Record<string, number>
}

// ─── Định nghĩa cột sau cột "Hình thức XL" và "Người XL" ─────────────────────
interface ColDef {
    key: keyof Document | string
    label: string
    minW?: number
    sortable?: SortField
    render?: (doc: Document) => React.ReactNode
}

// Helper render cell đơn giản
function strCell(val: string | null | undefined, maxLen = 60) {
    return val ? <span>{truncate(val, maxLen)}</span> : <span className="text-slate-300">—</span>
}

// ─── Cấu hình cột theo từng loại trang ────────────────────────────────────────

// NQ cần xử lý – 13 cột sau người xử lý
const COLS_NQ_CAN: ColDef[] = [
    { key: 'reg_doc_agency', label: 'VB đăng ký XD NQ (cơ quan ST)', minW: 140, render: d => strCell(d.reg_doc_agency) },
    { key: 'reg_doc_reply', label: 'Phúc đáp', minW: 110, render: d => strCell(d.reg_doc_reply) },
    { key: 'reg_doc_ubnd', label: 'VB đăng ký XD NQ (UBND tỉnh)', minW: 140, render: d => strCell(d.reg_doc_ubnd) },
    { key: 'approval_hdnd', label: 'Ý kiến TT.HĐND tỉnh', minW: 130, render: d => strCell(d.approval_hdnd) },
    {
        key: 'expected_date', label: 'Dự kiến trình', minW: 110, sortable: 'expected_date',
        render: d => d.expected_date
            ? <span className="text-blue-600 font-medium">{d.expected_date}</span>
            : <span className="text-slate-300">—</span>
    },
    { key: 'feedback_sent', label: 'Gửi lấy ý kiến góp ý', minW: 130, render: d => strCell(d.feedback_sent) },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', minW: 110, render: d => strCell(d.feedback_reply) },
    { key: 'appraisal_sent', label: 'Gửi Sở TP thẩm định', minW: 130, render: d => strCell(d.appraisal_sent) },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', minW: 110, render: d => strCell(d.appraisal_reply) },
    { key: 'submitted_ubnd', label: 'Cơ quan trình UBND', minW: 120, render: d => strCell(d.submitted_ubnd) },
    { key: 'submitted_hdnd', label: 'UBND trình HĐND', minW: 110, render: d => strCell(d.submitted_hdnd) },
    {
        key: 'issuance_number', label: 'Số/Ngày ban hành VBQPPL', minW: 160,
        render: d => d.issuance_number
            ? <p className="text-green-700 font-medium">{truncate(d.issuance_number, 60)}</p>
            : <span className="text-slate-300">—</span>
    },
    { key: 'notes', label: 'Ghi chú', minW: 110, render: d => strCell(d.notes, 40) },
]

// NQ đã xử lý – như trên nhưng thêm Thời gian xử lý, bỏ Ghi chú
const COLS_NQ_DA: ColDef[] = [
    ...COLS_NQ_CAN.filter(c => c.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', minW: 140, render: d => strCell(d.processing_time) },
]

// QD UBND cần xử lý
const COLS_QD_UBND_CAN: ColDef[] = [
    { key: 'reg_doc_agency', label: 'VB đăng ký xây dựng', minW: 130, render: d => strCell(d.reg_doc_agency) },
    { key: 'reg_doc_reply', label: 'Phúc đáp', minW: 110, render: d => strCell(d.reg_doc_reply) },
    { key: 'approval_hdnd', label: 'Chấp thuận của UBND tỉnh', minW: 130, render: d => strCell(d.approval_hdnd) },
    {
        key: 'expected_date', label: 'Dự kiến trình', minW: 110, sortable: 'expected_date',
        render: d => d.expected_date
            ? <span className="text-blue-600 font-medium">{d.expected_date}</span>
            : <span className="text-slate-300">—</span>
    },
    { key: 'feedback_sent', label: 'VB lấy ý kiến góp ý', minW: 120, render: d => strCell(d.feedback_sent) },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', minW: 110, render: d => strCell(d.feedback_reply) },
    { key: 'appraisal_sent', label: 'VB gửi Sở TP thẩm định', minW: 130, render: d => strCell(d.appraisal_sent) },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', minW: 110, render: d => strCell(d.appraisal_reply) },
    { key: 'submitted_vb', label: 'VB trình UBND ban hành', minW: 130, render: d => strCell(d.submitted_vb) },
    {
        key: 'issuance_number', label: 'Số/Ngày ban hành VBQPPL', minW: 160,
        render: d => d.issuance_number
            ? <p className="text-green-700 font-medium">{truncate(d.issuance_number, 60)}</p>
            : <span className="text-slate-300">—</span>
    },
    { key: 'notes', label: 'Ghi chú', minW: 110, render: d => strCell(d.notes, 40) },
]

// QD UBND đã xử lý – như trên, bỏ Ghi chú, thêm Thời gian xử lý
const COLS_QD_UBND_DA: ColDef[] = [
    ...COLS_QD_UBND_CAN.filter(c => c.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', minW: 140, render: d => strCell(d.processing_time) },
]

// QD CT.UBND – giống QD_UBND cần xử lý (cơ bản như nhau, htxl 3 cột)
const COLS_QD_CT_CAN: ColDef[] = COLS_QD_UBND_CAN

function getColDefs(docType: DocType, status: Status): ColDef[] {
    if (docType === 'NQ') return status === 'can_xu_ly' ? COLS_NQ_CAN : COLS_NQ_DA
    if (docType === 'QD_CT_UBND') return COLS_QD_CT_CAN
    // QD_UBND
    return status === 'can_xu_ly' ? COLS_QD_UBND_CAN : COLS_QD_UBND_DA
}

// ─── Badge hình thức xử lý ────────────────────────────────────────────────────
function ProcessingFormBadges({ doc, docType }: { doc: Document; docType: DocType }) {
    const all = [
        { key: 'count_thay_the', label: 'Thay thế', color: 'bg-blue-100 text-blue-800', count: doc.count_thay_the },
        { key: 'count_bai_bo', label: 'Bãi bỏ', color: 'bg-red-100 text-red-800', count: doc.count_bai_bo },
        { key: 'count_ban_hanh_moi', label: 'Ban hành mới', color: 'bg-green-100 text-green-800', count: doc.count_ban_hanh_moi },
    ]
    // Thêm "Chưa XĐ" cho NQ và QD_UBND (không có cho QD_CT_UBND)
    if (docType !== 'QD_CT_UBND') {
        all.push({ key: 'count_chua_xac_dinh', label: 'Chưa XĐ', color: 'bg-yellow-100 text-yellow-800', count: doc.count_chua_xac_dinh })
    }


    const badges = all.filter(b => b.count > 0)
    if (badges.length === 0) return <span className="text-slate-300">—</span>

    return (
        <div className="flex flex-wrap gap-1">
            {badges.map(f => (
                <span key={f.key}
                    className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold', f.color)}
                >
                    <span>{f.count}</span>
                    <span className="font-normal opacity-75">{f.label}</span>
                </span>
            ))}
        </div>
    )
}

// ─── Component chính ──────────────────────────────────────────────────────────
export default function DocumentsPage({ docType, status, title, description }: Props) {
    const supabase = createClient()
    const [docs, setDocs] = useState<Document[]>([])
    const [stats, setStats] = useState<DocStats | null>(null)
    const [agencies, setAgencies] = useState<Agency[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)

    const [search, setSearch] = useState('')
    const [filterHandler, setFilterHandler] = useState('')
    const [filterAgency, setFilterAgency] = useState('')
    const [sortField, setSortField] = useState<SortField>('stt')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [showAddModal, setShowAddModal] = useState(false)
    const [editDoc, setEditDoc] = useState<Document | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)
    const [showConfirmDelete, setShowConfirmDelete] = useState(false)
    const toast = useToast()

    const cols = getColDefs(docType, status)
    // Tổng số cột: Checkbox + STT + Tên + Cơ quan + HTXL + Người XL + dynamic cols
    const totalCols = 6 + cols.length

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function toggleSelectAll() {
        if (selectedIds.size === docs.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(docs.map(d => d.id)))
        }
    }

    function handleBatchDelete() {
        if (selectedIds.size === 0) return
        setShowConfirmDelete(true)
    }

    async function executeBatchDelete() {
        if (selectedIds.size === 0) return

        setDeleting(true)
        try {
            const res = await fetch('/api/documents', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedIds),
                    doc_type: docType,
                    status,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Lỗi khi xóa')
                return
            }
            toast.success(`Đã xóa ${json.deleted} văn bản và cập nhật STT`)
            setSelectedIds(new Set())
            setShowConfirmDelete(false)
            fetchDocs()
        } catch {
            toast.error('Không thể kết nối máy chủ')
        } finally {
            setDeleting(false)
        }
    }

    const fetchDocs = useCallback(async () => {
        setLoading(true)
        let query = supabase
            .from('v_documents_full')
            .select('*', { count: 'exact' })
            .eq('doc_type', docType)
            .eq('status', status)
            .order(sortField, { ascending: sortDir === 'asc' })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        let statsQuery = supabase
            .from('v_documents_full')
            .select('count_thay_the, count_bai_bo, count_ban_hanh_moi, count_chua_xac_dinh, handler_name')
            .eq('doc_type', docType)
            .eq('status', status)

        if (search.trim()) {
            const s = `%${search.trim()}%`
            query = query.ilike('name', s)
            statsQuery = statsQuery.ilike('name', s)
        }
        if (filterHandler) {
            query = query.eq('handler_name', filterHandler)
            statsQuery = statsQuery.eq('handler_name', filterHandler)
        }
        if (filterAgency) {
            query = query.eq('agency_id', filterAgency)
            statsQuery = statsQuery.eq('agency_id', filterAgency)
        }

        const [resDocs, resStats] = await Promise.all([query, statsQuery])

        if (!resDocs.error) {
            setDocs(resDocs.data as Document[])
            setTotal(resDocs.count ?? 0)
        }

        if (!resStats.error && resStats.data) {
            let thayThe = 0, baiBo = 0, banHanhMoi = 0, chuaXacDinh = 0
            const handlers: Record<string, number> = {}

            resStats.data.forEach(d => {
                thayThe += (d.count_thay_the || 0)
                baiBo += (d.count_bai_bo || 0)
                banHanhMoi += (d.count_ban_hanh_moi || 0)
                chuaXacDinh += (d.count_chua_xac_dinh || 0)

                const h = d.handler_name || 'Chưa phân công'
                handlers[h] = (handlers[h] || 0) + 1
            })

            setStats({ thayThe, baiBo, banHanhMoi, chuaXacDinh, handlers })
        }

        setLoading(false)
    }, [docType, status, search, filterHandler, filterAgency, sortField, sortDir, page])

    useEffect(() => {
        supabase.from('agencies').select('*').order('name').then(({ data }) => {
            if (data) setAgencies(data as Agency[])
        })
    }, [])

    useEffect(() => { setPage(0) }, [search, filterHandler, filterAgency, docType, status])
    useEffect(() => { fetchDocs() }, [fetchDocs])

    function toggleSort(field: SortField) {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('asc') }
    }

    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return <ChevronUp className="w-3 h-3 text-slate-300" />
        return sortDir === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-500" />
            : <ChevronDown className="w-3 h-3 text-blue-500" />
    }

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{description}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={fetchDocs}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" /> Tải lại
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                        <Download className="w-4 h-4" /> Xuất Excel
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Thêm VB
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm tên văn bản..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                    </div>

                    <select
                        value={filterHandler}
                        onChange={e => setFilterHandler(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                        <option value="">-- Chuyên viên --</option>
                        {HANDLER_NAMES.map(h => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                    </select>

                    <select
                        value={filterAgency}
                        onChange={e => setFilterAgency(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-[220px]"
                    >
                        <option value="">-- Cơ quan soạn thảo --</option>
                        {agencies.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>

                    {(search || filterHandler || filterAgency) && (
                        <button
                            onClick={() => { setSearch(''); setFilterHandler(''); setFilterAgency('') }}
                            className="px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            Xóa lọc
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                    {loading ? 'Đang tải...' : `Hiển thị ${docs.length} / ${total.toLocaleString()} nhóm văn bản`}
                </p>

                {/* Bản thống kê (Stats) */}
                {stats && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid md:grid-cols-2 gap-6 animate-fadeIn">
                        {/* Cột 1: Hình thức xử lý */}
                        <div>
                            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">
                                Tổng số theo hình thức xử lý
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span className="text-sm font-medium text-blue-900">Thay thế</span>
                                    <span className="text-sm font-bold text-blue-700 ml-1">{stats.thayThe}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="text-sm font-medium text-red-900">Bãi bỏ</span>
                                    <span className="text-sm font-bold text-red-700 ml-1">{stats.baiBo}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    <span className="text-sm font-medium text-green-900">Ban hành mới</span>
                                    <span className="text-sm font-bold text-green-700 ml-1">{stats.banHanhMoi}</span>
                                </div>
                                {docType !== 'QD_CT_UBND' && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-100 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                        <span className="text-sm font-medium text-yellow-900">Chưa xác định</span>
                                        <span className="text-sm font-bold text-yellow-700 ml-1">{stats.chuaXacDinh}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cột 2: Phân bổ Chuyên viên */}
                        <div>
                            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">
                                Phân bổ theo chuyên viên
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.handlers)
                                    .sort((a, b) => b[1] - a[1]) // Sắp xếp giảm dần
                                    .map(([handler, count]) => (
                                        <div key={handler} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                                            <span className="text-sm font-medium text-slate-700">{handler}</span>
                                            <span className="text-xs font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{count}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Selection toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between animate-fadeIn">
                    <span className="text-sm text-red-700 font-medium">
                        Đã chọn <strong>{selectedIds.size}</strong> văn bản
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Bỏ chọn
                        </button>
                        <button
                            onClick={handleBatchDelete}
                            disabled={deleting}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                            {deleting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang xóa...</>
                            ) : (
                                <><Trash2 className="w-4 h-4" /> Xóa {selectedIds.size} VB</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]">
                    <table className="w-full text-xs" style={{ minWidth: `${540 + cols.length * 130}px` }}>
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {/* Checkbox select all */}
                                <th className="w-10 px-2 py-2 bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={docs.length > 0 && selectedIds.size === docs.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
                                    />
                                </th>
                                {/* Cột cố định */}
                                <th
                                    className="text-left px-3 py-2 font-semibold text-slate-600 cursor-pointer hover:text-blue-600 whitespace-nowrap w-12 bg-slate-50"
                                    onClick={() => toggleSort('stt')}
                                >
                                    <span className="flex items-center gap-1">STT <SortIcon field="stt" /></span>
                                </th>
                                <th
                                    className="text-left px-3 py-2 font-semibold text-slate-600 cursor-pointer hover:text-blue-600 min-w-[220px] bg-slate-50"
                                    onClick={() => toggleSort('name')}
                                >
                                    <span className="flex items-center gap-1">Tên văn bản <SortIcon field="name" /></span>
                                </th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap min-w-[120px] bg-slate-50">Cơ quan ST</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap min-w-[140px] bg-slate-50">Hình thức XL</th>
                                <th
                                    className="text-left px-3 py-2 font-semibold text-slate-600 cursor-pointer hover:text-blue-600 whitespace-nowrap min-w-[100px] bg-slate-50"
                                    onClick={() => toggleSort('handler_name')}
                                >
                                    <span className="flex items-center gap-1">Người XL <SortIcon field="handler_name" /></span>
                                </th>

                                {/* Cột động theo docType/status */}
                                {cols.map(col => (
                                    <th
                                        key={col.key}
                                        className={cn(
                                            'text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap bg-slate-50',
                                            col.sortable && 'cursor-pointer hover:text-blue-600'
                                        )}
                                        style={col.minW ? { minWidth: col.minW } : undefined}
                                        onClick={col.sortable ? () => toggleSort(col.sortable!) : undefined}
                                    >
                                        {col.sortable
                                            ? <span className="flex items-center gap-1">{col.label} <SortIcon field={col.sortable} /></span>
                                            : col.label
                                        }
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={totalCols} className="text-center py-16 text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin opacity-40" />
                                            <span>Đang tải dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : docs.length === 0 ? (
                                <tr>
                                    <td colSpan={totalCols} className="text-center py-16 text-slate-400">
                                        Không có văn bản nào phù hợp
                                    </td>
                                </tr>
                            ) : (
                                docs.map((doc, i) => (
                                    <tr key={doc.id}
                                        onClick={() => setEditDoc(doc)}
                                        className={cn(
                                            'border-b border-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer',
                                            i % 2 === 0 ? '' : 'bg-slate-50/30',
                                            selectedIds.has(doc.id) && 'bg-blue-50 hover:bg-blue-100/60'
                                        )}
                                    >
                                        <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(doc.id)}
                                                onChange={() => toggleSelect(doc.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-500 font-mono">{doc.stt ?? i + 1 + page * PAGE_SIZE}</td>
                                        <td className="px-3 py-1.5">
                                            <p className="font-medium text-slate-800 leading-tight" title={doc.name}>
                                                {truncate(doc.name, 90)}
                                            </p>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <span className="text-slate-600">{doc.agency_name ?? '—'}</span>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <ProcessingFormBadges doc={doc} docType={docType} />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {doc.handler_name
                                                ? <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">{doc.handler_name}</span>
                                                : <span className="text-slate-300">—</span>
                                            }
                                        </td>
                                        {/* Cột động */}
                                        {cols.map(col => (
                                            <td key={col.key} className="px-3 py-1.5 text-slate-500">
                                                {col.render ? col.render(doc) : strCell((doc as any)[col.key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-sm text-slate-500">
                            Trang {page + 1} / {Math.ceil(total / PAGE_SIZE)}
                        </p>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setPage(0)}
                                disabled={page === 0}
                                className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                                title="Trang đầu"
                            >
                                ⟪ Đầu
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * PAGE_SIZE >= total}
                                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                            >
                                Sau →
                            </button>
                            <button
                                onClick={() => setPage(Math.ceil(total / PAGE_SIZE) - 1)}
                                disabled={(page + 1) * PAGE_SIZE >= total}
                                className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                                title="Trang cuối"
                            >
                                Cuối ⟫
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <AddDocumentModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={fetchDocs}
                docType={docType}
                status={status}
            />

            {/* Confirm Delete Modal */}
            <ConfirmModal
                open={showConfirmDelete}
                title="Xóa văn bản"
                message={`Bạn có chắc muốn xóa ${selectedIds.size} văn bản đã chọn? Hành động này không thể hoàn tác.`}
                confirmText={`Xóa ${selectedIds.size} văn bản`}
                onConfirm={executeBatchDelete}
                onCancel={() => setShowConfirmDelete(false)}
                loading={deleting}
            />

            {/* Edit Document Modal */}
            <AddDocumentModal
                open={!!editDoc}
                onClose={() => setEditDoc(null)}
                onSuccess={fetchDocs}
                docType={docType}
                status={status}
                editDoc={editDoc}
            />
        </div>
    )
}
