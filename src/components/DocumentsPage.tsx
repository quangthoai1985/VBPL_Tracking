'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
    Document, DocType, Status, DocCategory, ProcedureType, Agency, Handler,
    CATEGORY_FIELDS, DOC_CATEGORY_LABELS, PROCEDURE_TYPE_LABELS, DEADLINE_DAYS, REG_DOC_DEADLINE_DAYS,
} from '@/lib/types'
import { cn, truncate } from '@/lib/utils'
import { Search, RefreshCw, Plus, Download, ChevronUp, ChevronDown, Trash2, Loader2, AlertTriangle } from 'lucide-react'
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
    // Nhóm "Văn bản tiếp tục áp dụng"
    ttThayThe: number
    ttBaiBo: number
    ttKhongXuLy: number
    ttHetHieuLuc: number
    // Nhóm "Văn bản mới"
    vmBanHanhMoi: number
    vmSuaDoiBoSung: number
    vmThayThe: number
    vmBaiBo: number
    // Handlers
    handlers: Record<string, number>
    // Số VB cần rà soát
    needsReviewCount: number
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

// ─── Helper tính deadline và hiển thị badge cảnh báo ───────────────────────────
type DeadlineStatus = 'ok' | 'warning' | 'overdue' | 'late_replied' | 'on_time' | 'none'

function calcDeadlineStatus(
    sentDateStr: string | null | undefined,
    replyDateStr: string | null | undefined,
    maxDays: number,
): { status: DeadlineStatus; daysLeft?: number; deadlineStr?: string } {
    if (!sentDateStr) return { status: 'none' }
    const sentDate = new Date(sentDateStr)
    if (isNaN(sentDate.getTime())) return { status: 'none' }
    const deadline = new Date(sentDate)
    deadline.setDate(deadline.getDate() + maxDays)
    const deadlineStr = deadline.toLocaleDateString('vi-VN')

    if (replyDateStr) {
        const replyDate = new Date(replyDateStr)
        if (isNaN(replyDate.getTime())) return { status: 'none' }
        return replyDate > deadline
            ? { status: 'late_replied', deadlineStr }
            : { status: 'on_time', deadlineStr }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { status: 'overdue', daysLeft: Math.abs(daysLeft), deadlineStr }
    if (daysLeft <= 2) return { status: 'warning', daysLeft, deadlineStr }
    return { status: 'ok', daysLeft, deadlineStr }
}

function DeadlineBadgeCell({ doc, type }: { doc: Document; type: 'registration' | 'feedback' | 'appraisal' }) {
    let maxDays: number
    let sentDate: string | null
    let replyDate: string | null
    let replyText: string | null

    if (type === 'registration') {
        maxDays = REG_DOC_DEADLINE_DAYS
        sentDate = doc.reg_doc_agency_date ?? null
        replyDate = doc.reg_doc_reply_date ?? null
        replyText = doc.reg_doc_reply ?? null
    } else {
        const procType = doc.procedure_type as ProcedureType | null
        if (!procType || !DEADLINE_DAYS[procType]) return <span className="text-slate-300">—</span>
        const dl = DEADLINE_DAYS[procType]
        maxDays = type === 'feedback' ? dl.feedback : dl.appraisal
        sentDate = type === 'feedback' ? doc.feedback_sent_date : doc.appraisal_sent_date
        replyDate = type === 'feedback' ? doc.feedback_reply_date : doc.appraisal_reply_date
        replyText = type === 'feedback' ? doc.feedback_reply : doc.appraisal_reply
    }

    const { status, daysLeft, deadlineStr } = calcDeadlineStatus(sentDate, replyDate, maxDays)

    if (status === 'none') return strCell(replyText)

    const wrapClass = cn(
        'rounded-lg px-2 py-1 text-[11px] leading-snug',
        status === 'overdue' && 'bg-red-50 border border-red-300',
        status === 'warning' && 'bg-amber-50 border border-amber-300',
        status === 'late_replied' && 'bg-red-50 border border-red-200',
        status === 'on_time' && 'bg-green-50 border border-green-200',
        status === 'ok' && '',
    )

    return (
        <div className={wrapClass}>
            {replyText && <p className="text-slate-700 mb-0.5">{truncate(replyText, 40)}</p>}
            {status === 'overdue' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700">
                    🔴 Quá hạn {daysLeft} ngày!
                </span>
            )}
            {status === 'warning' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                    🟡 Còn {daysLeft} ngày (hạn: {deadlineStr})
                </span>
            )}
            {status === 'late_replied' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                    🔴 Trễ hạn ({deadlineStr})
                </span>
            )}
            {status === 'on_time' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700">
                    🟢 Đúng hạn ✓
                </span>
            )}
            {status === 'ok' && (
                <span className="text-[10px] text-blue-500">
                    Hạn: {deadlineStr}
                </span>
            )}
        </div>
    )
}

// ─── Badge loại quy trình ──────────────────────────────────────────────────────
function ProcedureTypeBadge({ doc }: { doc: Document }) {
    const pt = doc.procedure_type as ProcedureType | null
    if (!pt) return <span className="text-slate-300">—</span>
    return (
        <span className={cn(
            'inline-flex px-2 py-0.5 rounded text-[11px] font-semibold',
            pt === 'thuong'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-orange-100 text-orange-800 border border-orange-200',
        )}>
            {PROCEDURE_TYPE_LABELS[pt]}
        </span>
    )
}
// ─── Cấu hình cột theo từng loại trang ────────────────────────────────────────

// NQ cần xử lý – 13 cột sau người xử lý
const COLS_NQ_CAN: ColDef[] = [
    { key: 'reg_doc_agency', label: 'VB đăng ký XD NQ (cơ quan ST)', minW: 140, render: d => strCell(d.reg_doc_agency) },
    { key: 'reg_doc_reply', label: 'Phúc đáp đăng ký', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="registration" /> },
    { key: 'reg_doc_ubnd', label: 'VB đăng ký XD NQ (UBND tỉnh)', minW: 140, render: d => strCell(d.reg_doc_ubnd) },
    { key: 'approval_hdnd', label: 'Ý kiến TT.HĐND tỉnh', minW: 130, render: d => strCell(d.approval_hdnd) },
    { key: 'procedure_type', label: 'Quy trình', minW: 100, render: d => <ProcedureTypeBadge doc={d} /> },
    {
        key: 'expected_date', label: 'Dự kiến trình', minW: 110, sortable: 'expected_date',
        render: d => d.expected_date
            ? <span className="text-blue-600 font-medium">{d.expected_date}</span>
            : <span className="text-slate-300">—</span>
    },
    { key: 'feedback_sent', label: 'Gửi lấy ý kiến góp ý', minW: 130, render: d => strCell(d.feedback_sent) },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="feedback" /> },
    { key: 'appraisal_sent', label: 'Gửi Sở TP thẩm định', minW: 130, render: d => strCell(d.appraisal_sent) },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="appraisal" /> },
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

// NQ đã xử lý
const COLS_NQ_DA: ColDef[] = [
    ...COLS_NQ_CAN.filter(c => c.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', minW: 140, render: d => strCell(d.processing_time) },
]

// QD UBND cần xử lý
const COLS_QD_UBND_CAN: ColDef[] = [
    { key: 'reg_doc_agency', label: 'VB đăng ký xây dựng', minW: 130, render: d => strCell(d.reg_doc_agency) },
    { key: 'reg_doc_reply', label: 'Phúc đáp đăng ký', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="registration" /> },
    { key: 'approval_hdnd', label: 'Chấp thuận của UBND tỉnh', minW: 130, render: d => strCell(d.approval_hdnd) },
    { key: 'procedure_type', label: 'Quy trình', minW: 100, render: d => <ProcedureTypeBadge doc={d} /> },
    {
        key: 'expected_date', label: 'Dự kiến trình', minW: 110, sortable: 'expected_date',
        render: d => d.expected_date
            ? <span className="text-blue-600 font-medium">{d.expected_date}</span>
            : <span className="text-slate-300">—</span>
    },
    { key: 'feedback_sent', label: 'VB lấy ý kiến góp ý', minW: 120, render: d => strCell(d.feedback_sent) },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="feedback" /> },
    { key: 'appraisal_sent', label: 'VB gửi Sở TP thẩm định', minW: 130, render: d => strCell(d.appraisal_sent) },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', minW: 140, render: d => <DeadlineBadgeCell doc={d} type="appraisal" /> },
    { key: 'submitted_vb', label: 'VB trình UBND ban hành', minW: 130, render: d => strCell(d.submitted_vb) },
    {
        key: 'issuance_number', label: 'Số/Ngày ban hành VBQPPL', minW: 160,
        render: d => d.issuance_number
            ? <p className="text-green-700 font-medium">{truncate(d.issuance_number, 60)}</p>
            : <span className="text-slate-300">—</span>
    },
    { key: 'notes', label: 'Ghi chú', minW: 110, render: d => strCell(d.notes, 40) },
]

// QD UBND đã xử lý
const COLS_QD_UBND_DA: ColDef[] = [
    ...COLS_QD_UBND_CAN.filter(c => c.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', minW: 140, render: d => strCell(d.processing_time) },
]

const COLS_QD_CT_CAN: ColDef[] = COLS_QD_UBND_CAN

function getColDefs(docType: DocType, status: Status): ColDef[] {
    if (docType === 'NQ') return status === 'can_xu_ly' ? COLS_NQ_CAN : COLS_NQ_DA
    if (docType === 'QD_CT_UBND') return COLS_QD_CT_CAN
    return status === 'can_xu_ly' ? COLS_QD_UBND_CAN : COLS_QD_UBND_DA
}

// ─── Badge hình thức xử lý (NEW) ──────────────────────────────────────────────
function ProcessingFormBadges({ doc }: { doc: Document }) {
    const cat = doc.doc_category

    // Nếu needs_review → hiện badge cảnh báo
    if (doc.needs_review) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                <AlertTriangle className="w-3 h-3" />
                Cần rà soát
            </span>
        )
    }

    const badges: { label: string; count: number; color: string }[] = []

    if (cat === 'van_ban_tiep_tuc') {
        if (doc.count_tt_thay_the > 0) badges.push({ label: 'Thay thế', count: doc.count_tt_thay_the, color: 'bg-blue-100 text-blue-800' })
        if (doc.count_tt_bai_bo > 0) badges.push({ label: 'Bãi bỏ', count: doc.count_tt_bai_bo, color: 'bg-red-100 text-red-800' })
        if (doc.count_tt_khong_xu_ly > 0) badges.push({ label: 'Giữ nguyên', count: doc.count_tt_khong_xu_ly, color: 'bg-slate-100 text-slate-800' })
        if (doc.count_tt_het_hieu_luc > 0) badges.push({ label: 'Hết HL', count: doc.count_tt_het_hieu_luc, color: 'bg-purple-100 text-purple-800' })
    } else if (cat === 'van_ban_moi') {
        if (doc.count_vm_ban_hanh_moi > 0) badges.push({ label: 'Ban hành mới', count: doc.count_vm_ban_hanh_moi, color: 'bg-green-100 text-green-800' })
        if (doc.count_vm_sua_doi_bo_sung > 0) badges.push({ label: 'Sửa đổi BS', count: doc.count_vm_sua_doi_bo_sung, color: 'bg-teal-100 text-teal-800' })
        if (doc.count_vm_thay_the > 0) badges.push({ label: 'Thay thế', count: doc.count_vm_thay_the, color: 'bg-blue-100 text-blue-800' })
        if (doc.count_vm_bai_bo > 0) badges.push({ label: 'Bãi bỏ', count: doc.count_vm_bai_bo, color: 'bg-red-100 text-red-800' })
    }

    // Fallback: dùng legacy columns nếu chưa có cột mới
    if (badges.length === 0) {
        const legacyAll = [
            { label: 'Thay thế', count: doc.count_thay_the || 0, color: 'bg-blue-100 text-blue-800' },
            { label: 'Bãi bỏ', count: doc.count_bai_bo || 0, color: 'bg-red-100 text-red-800' },
            { label: 'Ban hành mới', count: doc.count_ban_hanh_moi || 0, color: 'bg-green-100 text-green-800' },
            { label: 'Chưa XĐ', count: doc.count_chua_xac_dinh || 0, color: 'bg-yellow-100 text-yellow-800' },
        ].filter(b => b.count > 0)
        if (legacyAll.length > 0) {
            return (
                <div className="flex flex-wrap gap-1.5">
                    {legacyAll.map(f => (
                        <div key={f.label} className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-1.5 rounded-full bg-orange-100 text-orange-700 font-bold text-xs">{f.count}</span>
                            <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', f.color)}>
                                {f.label}
                            </span>
                        </div>
                    ))}
                </div>
            )
        }
        return <span className="text-slate-300">—</span>
    }

    return (
        <div className="flex flex-wrap gap-1.5 items-center">
            {badges.map(f => (
                <div key={f.label} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-1.5 rounded-full bg-orange-100 text-orange-700 font-bold text-xs">{f.count}</span>
                    <span className={cn('px-2 py-0.5 rounded text-[11px] font-medium', f.color)}>
                        {f.label}
                    </span>
                </div>
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
    const [handlersList, setHandlersList] = useState<Handler[]>([])
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
            .select('doc_category, count_tt_thay_the, count_tt_bai_bo, count_tt_khong_xu_ly, count_tt_het_hieu_luc, count_vm_ban_hanh_moi, count_vm_sua_doi_bo_sung, count_vm_thay_the, count_vm_bai_bo, count_thay_the, count_bai_bo, count_ban_hanh_moi, count_chua_xac_dinh, handler_name, needs_review, procedure_type, feedback_sent_date, feedback_reply_date, appraisal_sent_date, appraisal_reply_date')
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
            let ttThayThe = 0, ttBaiBo = 0, ttKhongXuLy = 0, ttHetHieuLuc = 0
            let vmBanHanhMoi = 0, vmSuaDoiBoSung = 0, vmThayThe = 0, vmBaiBo = 0
            const handlers: Record<string, number> = {}
            let needsReviewCount = 0

            resStats.data.forEach((d: any) => {
                // Cột mới
                const tt1 = d.count_tt_thay_the || 0
                const tt2 = d.count_tt_bai_bo || 0
                const tt3 = d.count_tt_khong_xu_ly || 0
                const tt4 = d.count_tt_het_hieu_luc || 0
                const vm1 = d.count_vm_ban_hanh_moi || 0
                const vm2 = d.count_vm_sua_doi_bo_sung || 0
                const vm3 = d.count_vm_thay_the || 0
                const vm4 = d.count_vm_bai_bo || 0

                ttThayThe += tt1
                ttBaiBo += tt2
                ttKhongXuLy += tt3
                ttHetHieuLuc += tt4
                vmBanHanhMoi += vm1
                vmSuaDoiBoSung += vm2
                vmThayThe += vm3
                vmBaiBo += vm4

                if (d.needs_review) needsReviewCount++

                const h = d.handler_name || 'Chưa phân công'
                const totalForThisDoc = tt1 + tt2 + tt3 + tt4 + vm1 + vm2 + vm3 + vm4
                // Fallback nếu chưa migrate: dùng legacy
                const legacyTotal = (d.count_thay_the || 0) + (d.count_bai_bo || 0) + (d.count_ban_hanh_moi || 0) + (d.count_chua_xac_dinh || 0)
                const docTotal = totalForThisDoc > 0 ? totalForThisDoc : legacyTotal > 0 ? legacyTotal : 1
                handlers[h] = (handlers[h] || 0) + docTotal
            })

            setStats({ ttThayThe, ttBaiBo, ttKhongXuLy, ttHetHieuLuc, vmBanHanhMoi, vmSuaDoiBoSung, vmThayThe, vmBaiBo, handlers, needsReviewCount })
        }

        setLoading(false)
    }, [docType, status, search, filterHandler, filterAgency, sortField, sortDir, page])

    useEffect(() => {
        supabase.from('agencies').select('*').order('name').then(({ data }) => {
            if (data) setAgencies(data as Agency[])
        })
        supabase.from('handlers').select('*').eq('is_active', true).order('id').then(({ data }) => {
            if (data) setHandlersList(data as Handler[])
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

    // Tổng số mới
    const totalNewCount = stats
        ? stats.ttThayThe + stats.ttBaiBo + stats.ttKhongXuLy + stats.ttHetHieuLuc
        + stats.vmBanHanhMoi + stats.vmSuaDoiBoSung + stats.vmThayThe + stats.vmBaiBo
        : 0

    return (
        <div className="p-4 sm:p-6 flex flex-col flex-1 min-h-0 w-full h-full gap-4">
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
                        {handlersList.map(h => (
                            <option key={h.id} value={h.name}>{h.name}</option>
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
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-5 animate-fadeIn">
                        {/* Banner cần rà soát */}
                        {stats.needsReviewCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span className="text-sm text-amber-800">
                                    Có <strong>{stats.needsReviewCount}</strong> văn bản cần rà soát lại hình thức xử lý
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {/* Card 1: VB tiếp tục áp dụng */}
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
                                <div className="px-3 py-1.5 bg-indigo-100/80 border-b border-indigo-200">
                                    <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">◆ Văn bản tiếp tục áp dụng</h4>
                                </div>
                                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span className="text-blue-800">Thay thế</span>
                                        <span className="font-bold text-blue-600">{stats.ttThayThe}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-red-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span className="text-red-800">Bãi bỏ</span>
                                        <span className="font-bold text-red-600">{stats.ttBaiBo}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                        <span className="text-slate-700">Giữ nguyên</span>
                                        <span className="font-bold text-slate-600">{stats.ttKhongXuLy}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-purple-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        <span className="text-purple-800">Hết hiệu lực</span>
                                        <span className="font-bold text-purple-600">{stats.ttHetHieuLuc}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: VB mới */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden">
                                <div className="px-3 py-1.5 bg-emerald-100/80 border-b border-emerald-200">
                                    <h4 className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">◆ Văn bản mới</h4>
                                </div>
                                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-green-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span className="text-green-800">Ban hành mới</span>
                                        <span className="font-bold text-green-600">{stats.vmBanHanhMoi}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-teal-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                        <span className="text-teal-800">Sửa đổi BS</span>
                                        <span className="font-bold text-teal-600">{stats.vmSuaDoiBoSung}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-blue-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span className="text-blue-800">Thay thế</span>
                                        <span className="font-bold text-blue-600">{stats.vmThayThe}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-red-200 rounded-md text-xs shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span className="text-red-800">Bãi bỏ</span>
                                        <span className="font-bold text-red-600">{stats.vmBaiBo}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: Phân bổ theo chuyên viên */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                                <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200">
                                    <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Phân bổ theo chuyên viên</h4>
                                </div>
                                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                                    {Object.entries(stats.handlers)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([handler, count]) => (
                                            <span key={handler} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs shadow-sm">
                                                <span className="font-medium text-slate-700">{handler}</span>
                                                <span className="font-bold text-slate-500 bg-slate-100 px-1 rounded text-[10px]">{count}</span>
                                            </span>
                                        ))}
                                </div>
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
            <div className="bg-white rounded-xl border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-auto">
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
                                            selectedIds.has(doc.id) && 'bg-blue-50 hover:bg-blue-100/60',
                                            doc.needs_review && 'bg-amber-50/40 hover:bg-amber-50/70',
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
                                            <div className="flex items-center gap-1.5">
                                                {doc.needs_review && (
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                )}
                                                <p className="font-medium text-slate-800 leading-tight" title={doc.name}>
                                                    {truncate(doc.name, 90)}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <span className="text-slate-600">{doc.agency_name ?? '—'}</span>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <ProcessingFormBadges doc={doc} />
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
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
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
