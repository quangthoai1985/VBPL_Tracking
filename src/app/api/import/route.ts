import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'


// Server-side: dùng service_role key để bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

// Thứ tự đúng theo sheet Excel
const SHEET_MAP: Record<string, { docType: string; status: string }> = {
    'NQ can xu ly': { docType: 'NQ', status: 'can_xu_ly' },
    'QD UBND can xu ly': { docType: 'QD_UBND', status: 'can_xu_ly' },
    'QD CT.UBND': { docType: 'QD_CT_UBND', status: 'can_xu_ly' },
    'NQ HDND da xu ly': { docType: 'NQ', status: 'da_xu_ly' },
    'QD UBND da xu ly': { docType: 'QD_UBND', status: 'da_xu_ly' },
}

function norm(s: unknown): string | null {
    if (s === null || s === undefined) return null
    const v = String(s).trim()
    return v === '' || v.toLowerCase() === 'none' ? null : v
}

function toInt(v: unknown): number {
    if (v === null || v === undefined) return 0
    const n = Number(v)
    return isNaN(n) ? 0 : Math.max(0, Math.round(n))
}

function findCol(headers: string[], ...keywords: string[]): number {
    return headers.findIndex(h =>
        h && keywords.some(kw => h.toLowerCase().includes(kw.toLowerCase()))
    )
}

export async function POST(request: NextRequest) {
    const logs: string[] = []

    try {
        logs.push('⏳ Đang kết nối Supabase...')

        // Nhận file từ FormData (upload từ client)
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({
                logs: [...logs, '❌ Không có file Excel được upload.'],
                error: true
            })
        }

        logs.push(`✅ File Excel: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)

        const arrayBuffer = await file.arrayBuffer()
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
        logs.push(`📂 Sheets: ${wb.SheetNames.join(', ')}`)

        // -------------------------------------------------------------
        // BƯỚC 1: PRE-VALIDATION (Kiểm tra lỗi dữ liệu trước khi xóa DB)
        // Lỗi thường gặp: Trùng STT trong cùng một Sheet (cùng doc_type, status)
        // -------------------------------------------------------------
        logs.push('🔍 Đang kiểm tra tính hợp lệ của dữ liệu (Pre-validation)...')
        let hasValidationError = false

        for (const [sheetName] of Object.entries(SHEET_MAP)) {
            if (!wb.SheetNames.includes(sheetName)) continue

            const ws = wb.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
            if (rows.length < 3) continue

            const h1 = (rows[0] as unknown[]).map(c => norm(c) ?? '')
            const ciStt = findCol(h1, 'STT')
            const ciName = findCol(h1, 'Tên gọi văn bản', 'Tên gọi', 'TÊN GỌI')

            const seenStt = new Set<number>()
            const duplicateStts = new Set<number>()
            let sttCounter = 0

            for (const rawRow of rows.slice(2)) {
                const row = rawRow as unknown[]
                const name = ciName >= 0 ? norm(row[ciName]) : null
                if (!name) continue // Bỏ qua dòng trống

                sttCounter++
                let currentStt = sttCounter

                if (ciStt >= 0 && row[ciStt] !== null) {
                    const n = Number(row[ciStt])
                    if (!isNaN(n) && n > 0) currentStt = Math.round(n)
                }

                if (seenStt.has(currentStt)) {
                    duplicateStts.add(currentStt)
                } else {
                    seenStt.add(currentStt)
                }
            }

            if (duplicateStts.size > 0) {
                logs.push(`❌ [${sheetName}]: Phát hiện STT trùng lặp: ${Array.from(duplicateStts).join(', ')}`)
                hasValidationError = true
            }
        }

        if (hasValidationError) {
            logs.push('⛔ Import bị hủy bỏ vì có lỗi dữ liệu. Vui lòng sửa lại file Excel (không được để trùng STT) và thử lại.')
            return NextResponse.json({ logs, error: true }, { status: 400 })
        }
        logs.push('✅ Dữ liệu hợp lệ, chuẩn bị import...')

        // -------------------------------------------------------------
        // BƯỚC 2: TIẾN HÀNH XÓA VÀ IMPORT 
        // -------------------------------------------------------------
        // Xóa dữ liệu cũ
        logs.push('🗑️ Xóa dữ liệu cũ...')
        const { error: delDocErr } = await supabaseAdmin.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (delDocErr) logs.push(`⚠️ Xóa documents: ${delDocErr.message}`)

        const { error: delAgErr } = await supabaseAdmin.from('agencies').delete().neq('id', 0)
        if (delAgErr) logs.push(`⚠️ Xóa agencies: ${delAgErr.message}`)

        // Cache agencies
        const agencyCache: Record<string, number> = {}

        async function getOrCreateAgency(name: string): Promise<number | null> {
            if (!name?.trim()) return null
            const key = name.trim()
            if (agencyCache[key] !== undefined) return agencyCache[key]

            const { data: existing } = await supabaseAdmin
                .from('agencies').select('id').eq('name', key).maybeSingle()
            if (existing) { agencyCache[key] = existing.id; return existing.id }

            const { data: created, error } = await supabaseAdmin
                .from('agencies').insert({ name: key }).select('id').single()
            if (error || !created) { logs.push(`⚠️ Không tạo được agency: ${key}`); return null }

            agencyCache[key] = created.id
            return created.id
        }

        let totalInserted = 0

        for (const [sheetName, cfg] of Object.entries(SHEET_MAP)) {
            if (!wb.SheetNames.includes(sheetName)) {
                logs.push(`⚠️ Thiếu sheet: ${sheetName}`)
                continue
            }

            const ws = wb.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

            if (rows.length < 3) { logs.push(`⚠️ Sheet ${sheetName} trống`); continue }

            const h1 = (rows[0] as unknown[]).map(c => norm(c) ?? '')

            const ci = {
                stt: findCol(h1, 'STT'),
                name: findCol(h1, 'Tên gọi văn bản', 'Tên gọi', 'TÊN GỌI'),
                agency: findCol(h1, 'Cơ quan soạn thảo', 'Cơ quan soạn'),
                handler: findCol(h1, 'Người xử lý', 'Chuyên viên'),
                htxl: findCol(h1, 'Hình thức xử lý'),
                reg_agency: findCol(h1, 'VB đăng ký xây dựng', 'đăng ký xây dựng NQ của cơ quan'),
                reg_reply: findCol(h1, 'Ngày nhận/Số vb phúc đáp', 'phúc đáp'),
                reg_ubnd: findCol(h1, 'đăng ký xây dựng NQ của UBND', 'đăng ký của UBND'),
                approval_hdnd: findCol(h1, 'Ý kiến chấp thuận', 'chấp thuận'),
                expected: findCol(h1, 'dự kiến trình', 'Ngày dự kiến', 'Thời gian dự kiến'),
                feedback_sent: findCol(h1, 'lấy ý kiến góp ý', 'góp ý'),
                appraisal: findCol(h1, 'Sở Tư pháp thẩm định', 'gửi Sở Tư pháp', 'thẩm định'),
                sub_ubnd: findCol(h1, 'trình UBND tỉnh', 'Cơ quan soạn thảo trình UBND'),
                sub_hdnd: findCol(h1, 'UBND tỉnh trình HĐND', 'trình HĐND'),
                issuance: findCol(h1, 'Số, trích yếu', 'Số, ngày', 'ban hành VBQPPL', 'Số văn bản'),
                proc_time: findCol(h1, 'Thời gian xử lý'),
                notes: findCol(h1, 'Ghi chú'),
            }

            const baseHtxl = ci.htxl >= 0 ? ci.htxl : 3

            const gv = (row: unknown[], k: keyof typeof ci) => {
                const idx = ci[k]
                return idx >= 0 ? norm(row[idx]) : null
            }

            const batch: Record<string, unknown>[] = []
            let sttN = 0

            for (const rawRow of rows.slice(2)) {
                const row = rawRow as unknown[]
                const name = ci.name >= 0 ? norm(row[ci.name]) : null
                if (!name) continue

                sttN++
                let stt = sttN
                if (ci.stt >= 0 && row[ci.stt] !== null) {
                    const n = Number(row[ci.stt])
                    if (!isNaN(n) && n > 0) stt = Math.round(n)
                }

                const agencyName = gv(row, 'agency')
                const agencyId = agencyName ? await getOrCreateAgency(agencyName) : null

                const countThayThe = toInt(row[baseHtxl])
                const countBaiBo = toInt(row[baseHtxl + 1])
                const countBanHanhMoi = toInt(row[baseHtxl + 2])
                const countChuaXacDinh = toInt(row[baseHtxl + 3])

                const counts = [countThayThe, countBaiBo, countBanHanhMoi, countChuaXacDinh]
                const nonZero = counts.filter(c => c > 0)
                let processingForm: string | null = null
                if (nonZero.length === 1) {
                    const idx = counts.indexOf(nonZero[0])
                    processingForm = ['thay_the', 'bai_bo', 'ban_hanh_moi', 'chua_xac_dinh'][idx]
                } else if (nonZero.length > 1) {
                    const maxIdx = counts.indexOf(Math.max(...counts))
                    processingForm = ['thay_the', 'bai_bo', 'ban_hanh_moi', 'chua_xac_dinh'][maxIdx]
                }

                batch.push({
                    doc_type: cfg.docType,
                    status: cfg.status,
                    stt,
                    name,
                    agency_id: agencyId,
                    handler_name: gv(row, 'handler'),
                    processing_form: processingForm,
                    count_thay_the: countThayThe,
                    count_bai_bo: countBaiBo,
                    count_ban_hanh_moi: countBanHanhMoi,
                    count_chua_xac_dinh: countChuaXacDinh,
                    reg_doc_agency: gv(row, 'reg_agency'),
                    reg_doc_reply: gv(row, 'reg_reply'),
                    reg_doc_ubnd: gv(row, 'reg_ubnd'),
                    approval_hdnd: gv(row, 'approval_hdnd'),
                    expected_date: gv(row, 'expected'),
                    feedback_sent: gv(row, 'feedback_sent'),
                    appraisal_sent: gv(row, 'appraisal'),
                    submitted_ubnd: gv(row, 'sub_ubnd'),
                    submitted_hdnd: gv(row, 'sub_hdnd'),
                    issuance_number: gv(row, 'issuance'),
                    processing_time: gv(row, 'proc_time'),
                    notes: gv(row, 'notes'),
                    year: 2026,
                })

                if (batch.length >= 50) {
                    const { error } = await supabaseAdmin.from('documents').insert([...batch])
                    if (error) logs.push(`⚠️ Insert lỗi (${sheetName}): ${error.message}`)
                    batch.length = 0
                }
            }

            if (batch.length > 0) {
                const { error } = await supabaseAdmin.from('documents').insert([...batch])
                if (error) logs.push(`⚠️ Insert cuối (${sheetName}): ${error.message}`)
            }

            logs.push(`✅ [${sheetName}]: ${sttN} nhóm văn bản`)
            totalInserted += sttN
        }

        logs.push(``)
        logs.push(`🎉 Hoàn tất! ${totalInserted} nhóm, ${Object.keys(agencyCache).length} cơ quan.`)

        return NextResponse.json({ logs, success: true })

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logs.push(`❌ Lỗi: ${msg}`)
        return NextResponse.json({ logs, error: true }, { status: 500 })
    }
}
