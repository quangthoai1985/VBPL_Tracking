// TypeScript types cho hệ thống VBQPPL
// Tỉnh An Giang – Sở Tư pháp

export type DocType = 'NQ' | 'QD_UBND' | 'QD_CT_UBND'
export type Status = 'can_xu_ly' | 'da_xu_ly'
export type DocCategory = 'van_ban_tiep_tuc' | 'van_ban_moi'
export type UserRole = 'admin' | 'chuyen_vien' | 'co_quan' | 'guest'

export interface Agency {
    id: number
    name: string
    short_name: string | null
    created_at: string
}

export interface UserProfile {
    id: string
    full_name: string
    role: UserRole
    agency_id: number | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Document {
    id: string
    doc_type: DocType
    status: Status
    stt: number | null
    name: string
    agency_id: number | null
    handler_name: string | null

    // ──── Hình thức xử lý mới ────
    doc_category: DocCategory
    // Nhóm "Văn bản tiếp tục áp dụng"
    count_tt_thay_the: number
    count_tt_bai_bo: number
    count_tt_khong_xu_ly: number
    count_tt_het_hieu_luc: number
    // Nhóm "Văn bản mới"
    count_vm_ban_hanh_moi: number
    count_vm_sua_doi_bo_sung: number
    count_vm_thay_the: number
    count_vm_bai_bo: number

    // Flag: cần rà soát lại (dữ liệu cũ chưa nhập đầy đủ)
    needs_review: boolean

    // Legacy columns (giữ tạm cho backward compat)
    processing_form: string | null
    count_thay_the: number
    count_bai_bo: number
    count_ban_hanh_moi: number
    count_chua_xac_dinh: number

    // Workflow steps
    reg_doc_agency: string | null
    reg_doc_reply: string | null
    reg_doc_ubnd: string | null
    approval_hdnd: string | null
    expected_date: string | null
    feedback_sent: string | null
    feedback_reply: string | null
    appraisal_sent: string | null
    appraisal_reply: string | null
    submitted_ubnd: string | null
    submitted_hdnd: string | null
    submitted_vb: string | null
    issuance_number: string | null
    issuance_date: string | null
    processing_time: string | null
    notes: string | null
    year: number
    created_at: string
    updated_at: string
    created_by: string | null
    // Joined fields (từ v_documents_full view)
    agency_name?: string | null
    agency_short?: string | null
}

export interface AuditLog {
    id: number
    document_id: string | null
    user_id: string | null
    action: string | null
    field_name: string | null
    old_value: string | null
    new_value: string | null
    created_at: string
}

// View types
export interface SummaryStats {
    doc_type: DocType
    status: Status
    total: number
    thay_the: number
    bai_bo: number
    ban_hanh_moi: number
    chua_xac_dinh: number

}

export interface HandlerStats {
    handler_name: string
    doc_type: DocType
    can_xu_ly: number
    da_xu_ly: number
    tong_cong: number
}

export interface AgencyStats {
    agency_name: string
    agency_short: string | null
    can_xu_ly: number
    da_xu_ly: number
    tong_cong: number
}

// Labels cho UI
export const DOC_TYPE_LABELS: Record<DocType, string> = {
    NQ: 'Nghị quyết HĐND',
    QD_UBND: 'Quyết định UBND',
    QD_CT_UBND: 'Quyết định CT.UBND',
}

export const STATUS_LABELS: Record<Status, string> = {
    can_xu_ly: 'Cần xử lý',
    da_xu_ly: 'Đã xử lý',
}

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
    van_ban_tiep_tuc: 'Văn bản tiếp tục áp dụng',
    van_ban_moi: 'Văn bản mới',
}

// Thuộc tính theo từng nhóm
export const CATEGORY_FIELDS = {
    van_ban_tiep_tuc: [
        { key: 'count_tt_thay_the', label: 'Thay thế' },
        { key: 'count_tt_bai_bo', label: 'Bãi bỏ' },
        { key: 'count_tt_khong_xu_ly', label: 'Giữ nguyên' },
        { key: 'count_tt_het_hieu_luc', label: 'Hết hiệu lực theo thời gian' },
    ],
    van_ban_moi: [
        { key: 'count_vm_ban_hanh_moi', label: 'Ban hành mới' },
        { key: 'count_vm_sua_doi_bo_sung', label: 'Sửa đổi bổ sung' },
        { key: 'count_vm_thay_the', label: 'Thay thế' },
        { key: 'count_vm_bai_bo', label: 'Bãi bỏ' },
    ],
} as const

export const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Quản trị viên',
    chuyen_vien: 'Chuyên viên',
    co_quan: 'Cơ quan soạn thảo',
    guest: 'Khách',
}

export interface Handler {
    id: number
    name: string
    is_active: boolean
    created_at: string
}
