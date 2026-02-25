'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, FileText, Pencil } from 'lucide-react'
import { Document, DocType, Status, Agency, HANDLER_NAMES } from '@/lib/types'
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
    type?: 'text' | 'number' | 'textarea'
    placeholder?: string
}

const COUNT_FIELDS: FieldDef[] = [
    { key: 'count_thay_the', label: 'Thay thế', type: 'number', placeholder: '0' },
    { key: 'count_bai_bo', label: 'Bãi bỏ', type: 'number', placeholder: '0' },
    { key: 'count_ban_hanh_moi', label: 'Ban hành mới', type: 'number', placeholder: '0' },
    { key: 'count_chua_xac_dinh', label: 'Chưa xác định', type: 'number', placeholder: '0' },

]

// Workflow fields cho NQ
const WORKFLOW_NQ_CAN: FieldDef[] = [
    { key: 'reg_doc_agency', label: 'VB đăng ký XD NQ (cơ quan ST)', placeholder: 'Nhập...' },
    { key: 'reg_doc_reply', label: 'Phúc đáp', placeholder: 'Nhập...' },
    { key: 'reg_doc_ubnd', label: 'VB đăng ký XD NQ (UBND tỉnh)', placeholder: 'Nhập...' },
    { key: 'approval_hdnd', label: 'Ý kiến TT.HĐND tỉnh', placeholder: 'Nhập...' },
    { key: 'expected_date', label: 'Dự kiến trình', placeholder: 'VD: Tháng 6/2026' },
    { key: 'feedback_sent', label: 'Gửi lấy ý kiến góp ý', placeholder: 'Nhập...' },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', placeholder: 'Nhập...' },
    { key: 'appraisal_sent', label: 'Gửi Sở TP thẩm định', placeholder: 'Nhập...' },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', placeholder: 'Nhập...' },
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
    { key: 'reg_doc_agency', label: 'VB đăng ký xây dựng', placeholder: 'Nhập...' },
    { key: 'reg_doc_reply', label: 'Phúc đáp', placeholder: 'Nhập...' },
    { key: 'approval_hdnd', label: 'Chấp thuận của UBND tỉnh', placeholder: 'Nhập...' },
    { key: 'expected_date', label: 'Dự kiến trình', placeholder: 'VD: Tháng 6/2026' },
    { key: 'feedback_sent', label: 'VB lấy ý kiến góp ý', placeholder: 'Nhập...' },
    { key: 'feedback_reply', label: 'Phúc đáp ý kiến', placeholder: 'Nhập...' },
    { key: 'appraisal_sent', label: 'VB gửi Sở TP thẩm định', placeholder: 'Nhập...' },
    { key: 'appraisal_reply', label: 'Phúc đáp thẩm định', placeholder: 'Nhập...' },
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
    'count_thay_the', 'count_bai_bo', 'count_ban_hanh_moi',
    'count_chua_xac_dinh',
    'reg_doc_agency', 'reg_doc_reply', 'reg_doc_ubnd', 'approval_hdnd',
    'expected_date', 'feedback_sent', 'feedback_reply',
    'appraisal_sent', 'appraisal_reply',
    'submitted_ubnd', 'submitted_hdnd', 'submitted_vb',
    'issuance_number', 'issuance_date', 'processing_time', 'notes',
]

// ─── Component chính ───────────────────────────────────────────────────────────
export default function AddDocumentModal({ open, onClose, onSuccess, docType, status, editDoc }: Props) {
    const toast = useToast()
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Record<string, string | number>>({})
    const [agencies, setAgencies] = useState<Agency[]>([])

    const isEdit = !!editDoc
    const workflowFields = getWorkflowFields(docType, status)

    // Fetch agencies
    useEffect(() => {
        if (!open) return
        import('@/lib/supabase/client').then(({ createClient }) => {
            const supabase = createClient()
            supabase.from('agencies').select('*').order('name').then(({ data }) => {
                if (data) setAgencies(data as Agency[])
            })
        })
    }, [open])

    // Load form từ editDoc hoặc reset khi thêm mới
    useEffect(() => {
        if (!open) return
        if (editDoc) {
            const loaded: Record<string, string | number> = {}
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
    }, [open, editDoc])

    // Prevent body scroll
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [open])

    function updateField(key: string, value: string | number) {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    async function handleSubmit() {
        // Validation
        if (!form.name || String(form.name).trim() === '') {
            toast.warning('Vui lòng nhập tên văn bản')
            return
        }

        setSaving(true)
        try {
            const payload = {
                ...form,
                doc_type: docType,
                status,
                year: 2026,
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
                                        value={form.agency_id ?? ''}
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
                                        value={form.name ?? ''}
                                        onChange={e => updateField('name', e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors resize-none"
                                    />
                                </div>

                                {/* Người xử lý */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Người xử lý</label>
                                    <select
                                        value={form.handler_name ?? ''}
                                        onChange={e => updateField('handler_name', e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors"
                                    >
                                        <option value="">-- Chọn chuyên viên --</option>
                                        {HANDLER_NAMES.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Placeholder for grid alignment */}
                                <div />
                            </div>
                        </section>

                        {/* Section: Hình thức xử lý */}
                        <section>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-emerald-500 rounded-full" />
                                Hình thức xử lý (số lượng VB)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                {COUNT_FIELDS.map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            value={form[f.key] ?? ''}
                                            onChange={e => updateField(f.key, Number(e.target.value))}
                                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors text-center"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Section: Quy trình */}
                        <section>
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-amber-500 rounded-full" />
                                Quy trình xử lý
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {workflowFields.map(f => (
                                    <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">{f.label}</label>
                                        {f.type === 'textarea' ? (
                                            <textarea
                                                rows={2}
                                                placeholder={f.placeholder}
                                                value={form[f.key] ?? ''}
                                                onChange={e => updateField(f.key, e.target.value)}
                                                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors resize-none"
                                            />
                                        ) : (
                                            <input
                                                type={f.type ?? 'text'}
                                                placeholder={f.placeholder}
                                                value={form[f.key] ?? ''}
                                                onChange={e => updateField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-slate-50/50 hover:bg-white transition-colors"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
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
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.3s ease-out;
                }
            `}</style>
        </div>
    )
}
