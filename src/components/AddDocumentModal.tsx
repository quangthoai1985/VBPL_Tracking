'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, FileText, Pencil, AlertTriangle } from 'lucide-react'
import { Document, DocType, Status, DocCategory, ProcedureType, Agency, Handler, CATEGORY_FIELDS, DOC_CATEGORY_LABELS, PROCEDURE_TYPE_LABELS, DEADLINE_DAYS, REG_DOC_DEADLINE_DAYS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'

interface Props {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    docType: DocType
    status: Status
    /** Nếu truyền editDoc thì modal ở chế độ chỉnh sửa, ngược lại là thêm mới */
    editDoc?: Document | null
}

// ─── Cấu hình trường workflow theo docType/status ──────────────────────────────
interface FieldDef {
    key: string
    label: string
    type?: 'text' | 'number' | 'textarea' | 'date'
    placeholder?: string
}

// ═══ Các trường date-pair sẽ render trong khung viền riêng ═══
const DEADLINE_DATE_KEYS = new Set([
    'feedback_sent', 'feedback_sent_date', 'feedback_reply', 'feedback_reply_date',
    'appraisal_sent', 'appraisal_sent_date', 'appraisal_reply', 'appraisal_reply_date',
])

// Cấu hình 2 nhóm deadline: Góp ý + Thẩm định
interface DeadlineGroup {
    title: string
    icon: string
    color: string // tailwind color prefix
    textKey: string   // VB gửi
    dateKey: string   // Ngày gửi
    replyTextKey: string  // VB phúc đáp
    replyDateKey: string  // Ngày phúc đáp
    deadlineType: 'registration' | 'feedback' | 'appraisal'
    fixedDeadlineDays?: number  // dùng khi deadline cố định (không phụ thuộc procedure_type)
}

function getDeadlineGroups(docType: DocType): DeadlineGroup[] {
    return [
        {
            title: 'Đăng ký xây dựng',
            icon: '📝',
            color: 'teal',
            textKey: 'reg_doc_agency',
            dateKey: 'reg_doc_agency_date',
            replyTextKey: 'reg_doc_reply',
            replyDateKey: 'reg_doc_reply_date',
            deadlineType: 'registration',
            fixedDeadlineDays: REG_DOC_DEADLINE_DAYS,
        },
        {
            title: 'Góp ý',
            icon: '💬',
            color: 'indigo',
            textKey: 'feedback_sent',
            dateKey: 'feedback_sent_date',
            replyTextKey: 'feedback_reply',
            replyDateKey: 'feedback_reply_date',
            deadlineType: 'feedback',
        },
        {
            title: 'Thẩm định',
            icon: '📋',
            color: 'violet',
            textKey: 'appraisal_sent',
            dateKey: 'appraisal_sent_date',
            replyTextKey: 'appraisal_reply',
            replyDateKey: 'appraisal_reply_date',
            deadlineType: 'appraisal',
        },
    ]
}

// Lấy label phù hợp theo docType
function getFieldLabel(key: string, docType: DocType): string {
    const labels: Record<string, Record<string, string>> = {
        reg_doc_agency: { NQ: 'VB đăng ký XD NQ (cơ quan ST)', QD_UBND: 'VB đăng ký xây dựng', QD_CT_UBND: 'VB đăng ký xây dựng' },
        feedback_sent: { NQ: 'Gửi lấy ý kiến góp ý', QD_UBND: 'VB lấy ý kiến góp ý', QD_CT_UBND: 'VB lấy ý kiến góp ý' },
        appraisal_sent: { NQ: 'Gửi Sở TP thẩm định', QD_UBND: 'VB gửi Sở TP thẩm định', QD_CT_UBND: 'VB gửi Sở TP thẩm định' },
    }
    return labels[key]?.[docType] ?? key
}

// Workflow fields cho NQ — đã loại 8 trường date-pair
const WORKFLOW_NQ_CAN: FieldDef[] = [
    // reg_doc_agency + reg_doc_reply → render trong khung viền Đăng ký
    { key: 'reg_doc_ubnd', label: 'VB đăng ký XD NQ (UBND tỉnh)', placeholder: 'Nhập...' },
    { key: 'approval_hdnd', label: 'Ý kiến TT.HĐND tỉnh', placeholder: 'Nhập...' },
    // procedure_type + deadline groups render riêng
    { key: 'expected_date', label: 'Dự kiến trình', placeholder: 'VD: Tháng 6/2026' },
    // ← 8 trường feedback/appraisal sẽ render trong khung viền ↓
    { key: 'submitted_ubnd', label: 'Cơ quan trình UBND', placeholder: 'Nhập...' },
    { key: 'submitted_hdnd', label: 'UBND trình HĐND', placeholder: 'Nhập...' },
    { key: 'issuance_number', label: 'Số/Ngày ban hành VBQPPL', placeholder: 'VD: 15/2026/NQ-HĐND' },
    { key: 'notes', label: 'Ghi chú', type: 'textarea', placeholder: 'Ghi chú thêm...' },
]

const WORKFLOW_NQ_DA: FieldDef[] = [
    ...WORKFLOW_NQ_CAN.filter(f => f.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', placeholder: 'VD: 3 tháng' },
]

const WORKFLOW_QD_UBND_CAN: FieldDef[] = [
    // reg_doc_agency + reg_doc_reply → render trong khung viền Đăng ký
    { key: 'approval_hdnd', label: 'Chấp thuận của UBND tỉnh', placeholder: 'Nhập...' },
    // procedure_type + deadline groups render riêng
    { key: 'expected_date', label: 'Dự kiến trình', placeholder: 'VD: Tháng 6/2026' },
    // ← 8 trường feedback/appraisal sẽ render trong khung viền ↓
    { key: 'submitted_vb', label: 'VB trình UBND ban hành', placeholder: 'Nhập...' },
    { key: 'issuance_number', label: 'Số/Ngày ban hành VBQPPL', placeholder: 'VD: 25/2026/QĐ-UBND' },
    { key: 'notes', label: 'Ghi chú', type: 'textarea', placeholder: 'Ghi chú thêm...' },
]

const WORKFLOW_QD_UBND_DA: FieldDef[] = [
    ...WORKFLOW_QD_UBND_CAN.filter(f => f.key !== 'notes'),
    { key: 'processing_time', label: 'Thời gian xử lý', placeholder: 'VD: 3 tháng' },
]

const WORKFLOW_QD_CT: FieldDef[] = WORKFLOW_QD_UBND_CAN

function getWorkflowFields(docType: DocType, status: Status): FieldDef[] {
    if (docType === 'NQ') return status === 'can_xu_ly' ? WORKFLOW_NQ_CAN : WORKFLOW_NQ_DA
    if (docType === 'QD_CT_UBND') return WORKFLOW_QD_CT
    return status === 'can_xu_ly' ? WORKFLOW_QD_UBND_CAN : WORKFLOW_QD_UBND_DA
}

const DOC_TYPE_NAMES: Record<DocType, string> = {
    NQ: 'Nghị quyết HĐND',
    QD_UBND: 'Quyết định UBND',
    QD_CT_UBND: 'Quyết định CT.UBND',
}

// Các trường sẽ được load từ document khi edit
const EDITABLE_KEYS = [
    'stt', 'name', 'agency_id', 'handler_name',
    'doc_category',
    'count_tt_thay_the', 'count_tt_bai_bo', 'count_tt_khong_xu_ly', 'count_tt_het_hieu_luc',
    'count_vm_ban_hanh_moi', 'count_vm_sua_doi_bo_sung', 'count_vm_thay_the', 'count_vm_bai_bo',
    'needs_review',
    // Legacy (backward compat)
    'count_thay_the', 'count_bai_bo', 'count_ban_hanh_moi', 'count_chua_xac_dinh',
    'reg_doc_agency', 'reg_doc_reply', 'reg_doc_ubnd', 'approval_hdnd',
    'procedure_type',
    'expected_date',
    'feedback_sent', 'feedback_sent_date', 'feedback_reply', 'feedback_reply_date',
    'appraisal_sent', 'appraisal_sent_date', 'appraisal_reply', 'appraisal_reply_date',
    'submitted_ubnd', 'submitted_hdnd', 'submitted_vb',
    'issuance_number', 'issuance_date', 'processing_time', 'notes',
]

// ─── Component chính ───────────────────────────────────────────────────────────
export default function AddDocumentModal({ open, onClose, onSuccess, docType, status, editDoc }: Props) {
    const toast = useToast()
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Record<string, string | number | boolean>>({})
    const [agencies, setAgencies] = useState<Agency[]>([])
    const [handlersList, setHandlersList] = useState<Handler[]>([])
    const [categoryError, setCategoryError] = useState(false)

    const isEdit = !!editDoc
    const workflowFields = getWorkflowFields(docType, status)

    // Lấy doc_category từ form
    const selectedCategory = form.doc_category as DocCategory | undefined
    const categoryFields = selectedCategory ? CATEGORY_FIELDS[selectedCategory] : []

    // Kiểm tra needs_review
    const needsReview = isEdit && editDoc?.needs_review === true

    // Fetch agencies
    useEffect(() => {
        if (!open) return
        import('@/lib/supabase/client').then(({ createClient }) => {
            const supabase = createClient()
            supabase.from('agencies').select('*').order('name').then(({ data }) => {
                if (data) setAgencies(data as Agency[])
            })
            supabase.from('handlers').select('*').eq('is_active', true).order('id').then(({ data }) => {
                if (data) setHandlersList(data as Handler[])
            })
        })
    }, [open])

    // Load form từ editDoc hoặc reset khi thêm mới
    useEffect(() => {
        if (!open) return
        if (editDoc) {
            const loaded: Record<string, string | number | boolean> = {}
            for (const key of EDITABLE_KEYS) {
                const val = (editDoc as any)[key]
                if (val !== null && val !== undefined) {
                    loaded[key] = val
                }
            }
            setForm(loaded)
        } else {
            setForm({})
        }
        setCategoryError(false)
    }, [open, editDoc])

    // Prevent body scroll
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [open])

    function updateField(key: string, value: string | number | boolean) {
        setForm(prev => ({ ...prev, [key]: value }))
        if (key === 'doc_category') setCategoryError(false)
    }

    function selectCategory(cat: DocCategory) {
        // Khi chuyển nhóm, xóa giá trị count của nhóm kia
        const otherCat = cat === 'van_ban_tiep_tuc' ? 'van_ban_moi' : 'van_ban_tiep_tuc'
        const newForm: Record<string, string | number | boolean> = { ...form, doc_category: cat }
        // Reset các count của nhóm cũ
        for (const f of CATEGORY_FIELDS[otherCat]) {
            newForm[f.key] = 0
        }
        setForm(newForm)
        setCategoryError(false)
    }

    async function handleSubmit() {
        // Validation tên VB
        if (!form.name || String(form.name).trim() === '') {
            toast.warning('Vui lòng nhập tên văn bản')
            return
        }

        // Validation nhóm hình thức xử lý
        if (!form.doc_category) {
            setCategoryError(true)
            toast.error('Vui lòng chọn nhóm hình thức xử lý (Văn bản tiếp tục áp dụng hoặc Văn bản mới)')
            return
        }

        // Validation ít nhất 1 thuộc tính > 0
        const cat = form.doc_category as DocCategory
        const fields = CATEGORY_FIELDS[cat]
        const totalCount = fields.reduce((sum, f) => sum + (Number(form[f.key]) || 0), 0)
        if (totalCount === 0) {
            toast.error('Vui lòng nhập số lượng văn bản cho ít nhất một hình thức xử lý')
            return
        }

        setSaving(true)
        try {
            const payload: Record<string, any> = {
                ...form,
                doc_type: docType,
                status,
                year: 2026,
                // Khi lưu thành công → bỏ flag needs_review
                needs_review: false,
            }

            let res: Response
            if (isEdit) {
                // PUT – cập nhật
                res = await fetch('/api/documents', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editDoc!.id, ...payload }),
                })
            } else {
                // POST – thêm mới
                res = await fetch('/api/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
            }

            const json = await res.json()

            if (!res.ok) {
                toast.error(json.error || 'Lỗi khi lưu văn bản')
                return
            }

            toast.success(isEdit ? 'Cập nhật văn bản thành công!' : 'Thêm văn bản mới thành công!')
            onSuccess()
            onClose()
        } catch {
            toast.error('Không thể kết nối máy chủ')
        } finally {
            setSaving(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full h-full bg-white flex flex-col animate-slideUp">
                {/* Header */}
                <div className={cn(
                    'shrink-0 px-6 py-4 flex items-center justify-between shadow-md bg-gradient-to-r',
                    isEdit ? 'from-amber-500 to-orange-600' : 'from-blue-600 to-indigo-600',
                )}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            {isEdit
                                ? <Pencil className="w-5 h-5 text-white" />
                                : <FileText className="w-5 h-5 text-white" />
                            }
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {isEdit ? 'Chỉnh Sửa Văn Bản' : 'Thêm Văn Bản Mới'}
                            </h2>
                            <p className="text-white/80 text-sm">
                                {DOC_TYPE_NAMES[docType]} – {status === 'can_xu_ly' ? 'Cần Xử Lý' : 'Đã Xử Lý'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Banner needs_review */}
                {needsReview && (
                    <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800 font-medium">
                            Văn bản này cần được rà soát lại hình thức xử lý. Vui lòng chọn nhóm và nhập số lượng phù hợp.
                        </p>
                    </div>
                )}

                {/* Body – scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {/* Section: Thông tin cơ bản */}
                        <section>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
                                Thông tin cơ bản
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* STT */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">STT</label>
                                    <div className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-100 text-slate-500 italic">
                                        {isEdit ? `#${form.stt ?? '—'}` : 'Tự động gán'}
                                    </div>
                                </div>

                                {/* Cơ quan soạn thảo */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Cơ quan soạn thảo</label>
                                    <select
                                        value={form.agency_id as string ?? ''}
                                        onChange={e => updateField('agency_id', e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors"
                                    >
                                        <option value="">-- Chọn cơ quan --</option>
                                        {agencies.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Tên văn bản – full width */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                                        Tên văn bản <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Nhập tên văn bản..."
                                        value={form.name as string ?? ''}
                                        onChange={e => updateField('name', e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors resize-none"
                                    />
                                </div>

                                {/* Người xử lý */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Người xử lý</label>
                                    <select
                                        value={form.handler_name as string ?? ''}
                                        onChange={e => updateField('handler_name', e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors"
                                    >
                                        <option value="">-- Chọn chuyên viên --</option>
                                        {handlersList.map(h => (
                                            <option key={h.id} value={h.name}>{h.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Placeholder for grid alignment */}
                                <div />
                            </div>
                        </section>

                        {/* ═══ Section: Hình thức xử lý (MỚI) ═══ */}
                        <section>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className={cn(
                                    'w-1.5 h-5 rounded-full',
                                    needsReview ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                                )} />
                                Hình thức xử lý <span className="text-red-500">*</span>
                                {needsReview && (
                                    <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                        Cần rà soát
                                    </span>
                                )}
                            </h3>

                            {/* Radio buttons chọn nhóm */}
                            <div className={cn(
                                'grid grid-cols-1 md:grid-cols-2 gap-3 mb-5',
                                categoryError && 'animate-shake',
                            )}>
                                {(['van_ban_tiep_tuc', 'van_ban_moi'] as DocCategory[]).map(cat => {
                                    const isSelected = selectedCategory === cat
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => selectCategory(cat)}
                                            className={cn(
                                                'flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                                                isSelected
                                                    ? 'border-emerald-500 bg-emerald-50 shadow-sm shadow-emerald-100'
                                                    : categoryError
                                                        ? 'border-red-300 bg-red-50/30 hover:border-red-400'
                                                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30',
                                            )}
                                        >
                                            {/* Radio circle */}
                                            <div className={cn(
                                                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                                isSelected ? 'border-emerald-500' : categoryError ? 'border-red-300' : 'border-slate-300',
                                            )}>
                                                {isSelected && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                                )}
                                            </div>
                                            <div>
                                                <p className={cn(
                                                    'font-semibold text-sm',
                                                    isSelected ? 'text-emerald-800' : 'text-slate-700',
                                                )}>
                                                    {DOC_CATEGORY_LABELS[cat]}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {cat === 'van_ban_tiep_tuc'
                                                        ? 'Thay thế, Bãi bỏ, Giữ nguyên, Hết hiệu lực'
                                                        : 'Ban hành mới, Sửa đổi bổ sung, Thay thế, Bãi bỏ'
                                                    }
                                                </p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {categoryError && (
                                <p className="text-xs text-red-500 font-medium mb-3 -mt-3">
                                    ⚠ Vui lòng chọn một trong hai nhóm trên
                                </p>
                            )}

                            {/* Các ô nhập số lượng (hiện khi đã chọn nhóm) */}
                            {selectedCategory && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
                                    {categoryFields.map(f => (
                                        <div key={f.key}>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={form[f.key] as number ?? ''}
                                                onChange={e => updateField(f.key, Number(e.target.value))}
                                                className={cn(
                                                    'w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-colors text-center',
                                                    needsReview
                                                        ? 'border-amber-300 bg-amber-50/50 hover:bg-white focus:ring-amber-400'
                                                        : 'border-slate-200 bg-slate-50/50 hover:bg-white focus:ring-emerald-400',
                                                )}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Section: Quy trình */}
                        <section>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                Quy trình xử lý
                            </h3>

                            {/* ═══ Radio chọn loại quy trình ═══ */}
                            <div className="mb-5">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Loại quy trình <span className="text-slate-400 font-normal text-xs">(sau bước phê duyệt)</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['thuong', 'rut_gon'] as ProcedureType[]).map(pt => {
                                        const isSelected = form.procedure_type === pt
                                        return (
                                            <button
                                                key={pt}
                                                type="button"
                                                onClick={() => updateField('procedure_type', pt)}
                                                className={cn(
                                                    'flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all',
                                                    isSelected
                                                        ? pt === 'thuong'
                                                            ? 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                                                            : 'border-orange-500 bg-orange-50 shadow-sm shadow-orange-100'
                                                        : 'border-slate-200 bg-white hover:border-slate-300',
                                                )}
                                            >
                                                <div className={cn(
                                                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                                                    isSelected
                                                        ? pt === 'thuong' ? 'border-blue-500' : 'border-orange-500'
                                                        : 'border-slate-300',
                                                )}>
                                                    {isSelected && (
                                                        <div className={cn('w-2.5 h-2.5 rounded-full', pt === 'thuong' ? 'bg-blue-500' : 'bg-orange-500')} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className={cn('font-semibold text-sm', isSelected ? (pt === 'thuong' ? 'text-blue-800' : 'text-orange-800') : 'text-slate-700')}>
                                                        {PROCEDURE_TYPE_LABELS[pt]}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        {pt === 'thuong'
                                                            ? 'Góp ý: 10 ngày · Thẩm định: 15 ngày'
                                                            : 'Góp ý: 3 ngày · Thẩm định: 7 ngày'
                                                        }
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* ═══ FORM QUY TRÌNH — SẮP XẾP THEO THỨ TỰ CỘT DocumentsPage ═══ */}
                            {(() => {
                                // Tách trường thành 2 nhóm: "đề xuất" (trước expected_date) và "trình ban hành" (sau)
                                const idxExpected = workflowFields.findIndex(x => x.key === 'expected_date')
                                const beforeFields = workflowFields.filter((_, i) => i < idxExpected)
                                const expectedField = workflowFields.find(f => f.key === 'expected_date')
                                const afterFields = workflowFields.filter((_, i) => i > idxExpected)

                                const deadlineGroups = getDeadlineGroups(docType)
                                // Chỉ lấy registration group riêng (render đầu tiên)
                                const regGroup = deadlineGroups.find(g => g.deadlineType === 'registration')!
                                // feedback + appraisal (render sau procedure)
                                const otherGroups = deadlineGroups.filter(g => g.deadlineType !== 'registration')

                                // colorMap cho tất cả khung viền
                                const colorMap: Record<string, { border: string; bg: string; header: string; tag: string }> = {
                                    teal: { border: 'border-teal-200', bg: 'bg-teal-50/30', header: 'text-teal-700', tag: 'bg-teal-100 text-teal-800' },
                                    indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50/30', header: 'text-indigo-700', tag: 'bg-indigo-100 text-indigo-800' },
                                    violet: { border: 'border-violet-200', bg: 'bg-violet-50/30', header: 'text-violet-700', tag: 'bg-violet-100 text-violet-800' },
                                    slate: { border: 'border-slate-200', bg: 'bg-slate-50/30', header: 'text-slate-600', tag: 'bg-slate-100 text-slate-700' },
                                }

                                // Helper: render 1 deadline group
                                const renderDeadlineGroup = (group: DeadlineGroup) => {
                                    const procType = form.procedure_type as ProcedureType | undefined
                                    const dl = procType ? DEADLINE_DAYS[procType] : null
                                    const maxDays = group.fixedDeadlineDays
                                        ?? (dl ? (group.deadlineType === 'feedback' ? dl.feedback : dl.appraisal) : null)

                                    let replyBadge: React.ReactNode = null
                                    if (maxDays && form[group.dateKey]) {
                                        const sentDate = new Date(form[group.dateKey] as string)
                                        if (!isNaN(sentDate.getTime())) {
                                            const deadline = new Date(sentDate)
                                            deadline.setDate(deadline.getDate() + maxDays)
                                            const deadlineStr = deadline.toLocaleDateString('vi-VN')
                                            const replyDateVal = form[group.replyDateKey] as string | undefined

                                            if (replyDateVal) {
                                                const replyDate = new Date(replyDateVal)
                                                const isLate = replyDate > deadline
                                                replyBadge = (
                                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                                                        {isLate ? `Trễ hạn (hạn: ${deadlineStr})` : `Đúng hạn ✓`}
                                                    </span>
                                                )
                                            } else {
                                                const today = new Date()
                                                today.setHours(0, 0, 0, 0)
                                                const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                                if (daysLeft < 0) {
                                                    replyBadge = <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">Quá hạn {Math.abs(daysLeft)} ngày!</span>
                                                } else if (daysLeft <= 2) {
                                                    replyBadge = <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">Còn {daysLeft} ngày (hạn: {deadlineStr})</span>
                                                } else {
                                                    replyBadge = <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">Hạn: {deadlineStr} ({daysLeft} ngày)</span>
                                                }
                                            }
                                        }
                                    }

                                    const c = colorMap[group.color] ?? colorMap.violet
                                    return (
                                        <div key={group.deadlineType} className={cn('rounded-xl border-2 p-4', c.border, c.bg)}>
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className={cn('text-sm font-bold flex items-center gap-1.5', c.header)}>
                                                    <span>{group.icon}</span> {group.title}
                                                </h4>
                                                {maxDays && (
                                                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', c.tag)}>
                                                        Tối đa {maxDays} ngày
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                                        {getFieldLabel(group.textKey, docType)}
                                                    </label>
                                                    <input type="text" placeholder="Nhập..."
                                                        value={form[group.textKey] as string ?? ''}
                                                        onChange={e => updateField(group.textKey, e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">📅 Ngày gửi</label>
                                                    <input type="date"
                                                        value={form[group.dateKey] as string ?? ''}
                                                        onChange={e => updateField(group.dateKey, e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Phúc đáp</label>
                                                    <input type="text" placeholder="Nhập..."
                                                        value={form[group.replyTextKey] as string ?? ''}
                                                        onChange={e => updateField(group.replyTextKey, e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <label className="block text-xs font-medium text-slate-500">📅 Ngày phúc đáp</label>
                                                        {replyBadge}
                                                    </div>
                                                    <input type="date"
                                                        value={form[group.replyDateKey] as string ?? ''}
                                                        onChange={e => updateField(group.replyDateKey, e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <div className="space-y-4">
                                        {/* ① 📝 Đăng ký xây dựng (teal) — đầu tiên */}
                                        {renderDeadlineGroup(regGroup)}

                                        {/* ② 📎 Đề xuất — reg_doc_ubnd, approval_hdnd, dự kiến trình (khung slate) */}
                                        {(beforeFields.length > 0 || expectedField) && (
                                            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/30 p-4">
                                                <h4 className="text-sm font-bold flex items-center gap-1.5 text-slate-600 mb-3">
                                                    📎 Đề xuất
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {beforeFields.map(f => (
                                                        <div key={f.key}>
                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                                                            <input type="text" placeholder={f.placeholder}
                                                                value={form[f.key] as string ?? ''}
                                                                onChange={e => updateField(f.key, e.target.value)}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                            />
                                                        </div>
                                                    ))}
                                                    {expectedField && (
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{expectedField.label}</label>
                                                            <input type="text" placeholder={expectedField.placeholder}
                                                                value={form[expectedField.key] as string ?? ''}
                                                                onChange={e => updateField(expectedField.key, e.target.value)}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ④ 💬 Góp ý (indigo) + 📋 Thẩm định (violet) */}
                                        {otherGroups.map(g => renderDeadlineGroup(g))}

                                        {/* ⑤ 🏛 Trình ban hành — submitted, issuance, notes (khung slate) */}
                                        {afterFields.length > 0 && (
                                            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/30 p-4">
                                                <h4 className="text-sm font-bold flex items-center gap-1.5 text-slate-600 mb-3">
                                                    🏛 Trình ban hành
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {afterFields.map(f => (
                                                        <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                                                            <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                                                            {f.type === 'textarea' ? (
                                                                <textarea rows={2} placeholder={f.placeholder}
                                                                    value={form[f.key] as string ?? ''}
                                                                    onChange={e => updateField(f.key, e.target.value)}
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors resize-none"
                                                                />
                                                            ) : (
                                                                <input type={f.type ?? 'text'} placeholder={f.placeholder}
                                                                    value={form[f.key] as string ?? ''}
                                                                    onChange={e => updateField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white hover:bg-white transition-colors"
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </section>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className={cn(
                            'flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all',
                            isEdit
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 hover:shadow-lg hover:shadow-amber-500/25'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/25',
                            'disabled:opacity-60 disabled:cursor-not-allowed',
                        )}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {isEdit ? 'Cập nhật' : 'Lưu văn bản'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Animations */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: scale(0.98) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-6px); }
                    75% { transform: translateX(6px); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
                .animate-shake {
                    animation: shake 0.3s ease-out;
                }
            `}</style>
        </div>
    )
}
