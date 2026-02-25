import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate required
        if (!body.name?.trim()) {
            return NextResponse.json(
                { error: 'Tên văn bản là bắt buộc' },
                { status: 400 },
            )
        }
        if (!body.doc_type || !body.status) {
            return NextResponse.json(
                { error: 'Loại văn bản và trạng thái là bắt buộc' },
                { status: 400 },
            )
        }

        const supabase = await createClient()

        // Auto STT: lấy max STT hiện tại + 1
        const { data: maxRow } = await supabase
            .from('documents')
            .select('stt')
            .eq('doc_type', body.doc_type)
            .eq('status', body.status)
            .order('stt', { ascending: false })
            .limit(1)
            .single()
        const nextStt = (maxRow?.stt ?? 0) + 1

        // Build insert payload – chỉ lấy các trường hợp lệ
        const doc = {
            doc_type: body.doc_type,
            status: body.status,
            stt: nextStt,
            name: body.name.trim(),
            agency_id: body.agency_id || null,
            handler_name: body.handler_name || null,
            processing_form: body.processing_form || null,
            count_thay_the: Number(body.count_thay_the) || 0,
            count_bai_bo: Number(body.count_bai_bo) || 0,
            count_ban_hanh_moi: Number(body.count_ban_hanh_moi) || 0,
            count_chua_xac_dinh: Number(body.count_chua_xac_dinh) || 0,
            count_het_hieu_luc: Number(body.count_het_hieu_luc) || 0,
            count_giu_nguyen: Number(body.count_giu_nguyen) || 0,
            reg_doc_agency: body.reg_doc_agency || null,
            reg_doc_reply: body.reg_doc_reply || null,
            reg_doc_ubnd: body.reg_doc_ubnd || null,
            approval_hdnd: body.approval_hdnd || null,
            expected_date: body.expected_date || null,
            feedback_sent: body.feedback_sent || null,
            feedback_reply: body.feedback_reply || null,
            appraisal_sent: body.appraisal_sent || null,
            appraisal_reply: body.appraisal_reply || null,
            submitted_ubnd: body.submitted_ubnd || null,
            submitted_hdnd: body.submitted_hdnd || null,
            submitted_vb: body.submitted_vb || null,
            issuance_number: body.issuance_number || null,
            issuance_date: body.issuance_date || null,
            processing_time: body.processing_time || null,
            notes: body.notes || null,
            year: body.year ?? 2026,
        }

        const { data, error } = await supabase
            .from('documents')
            .insert(doc)
            .select()
            .single()

        if (error) {
            console.error('Supabase insert error:', error)
            return NextResponse.json(
                { error: `Lỗi khi lưu: ${error.message}` },
                { status: 500 },
            )
        }

        return NextResponse.json({ data }, { status: 201 })
    } catch (err: any) {
        console.error('API /documents error:', err)
        return NextResponse.json(
            { error: 'Lỗi máy chủ nội bộ' },
            { status: 500 },
        )
    }
}

// ─── PUT: Cập nhật văn bản ─────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()

        if (!body.id) {
            return NextResponse.json(
                { error: 'Thiếu ID văn bản' },
                { status: 400 },
            )
        }
        if (!body.name?.trim()) {
            return NextResponse.json(
                { error: 'Tên văn bản là bắt buộc' },
                { status: 400 },
            )
        }

        const supabase = await createClient()

        const updates: Record<string, any> = {
            name: body.name.trim(),
            agency_id: body.agency_id || null,
            handler_name: body.handler_name || null,
            processing_form: body.processing_form || null,
            count_thay_the: Number(body.count_thay_the) || 0,
            count_bai_bo: Number(body.count_bai_bo) || 0,
            count_ban_hanh_moi: Number(body.count_ban_hanh_moi) || 0,
            count_chua_xac_dinh: Number(body.count_chua_xac_dinh) || 0,
            count_het_hieu_luc: Number(body.count_het_hieu_luc) || 0,
            count_giu_nguyen: Number(body.count_giu_nguyen) || 0,
            reg_doc_agency: body.reg_doc_agency || null,
            reg_doc_reply: body.reg_doc_reply || null,
            reg_doc_ubnd: body.reg_doc_ubnd || null,
            approval_hdnd: body.approval_hdnd || null,
            expected_date: body.expected_date || null,
            feedback_sent: body.feedback_sent || null,
            feedback_reply: body.feedback_reply || null,
            appraisal_sent: body.appraisal_sent || null,
            appraisal_reply: body.appraisal_reply || null,
            submitted_ubnd: body.submitted_ubnd || null,
            submitted_hdnd: body.submitted_hdnd || null,
            submitted_vb: body.submitted_vb || null,
            issuance_number: body.issuance_number || null,
            issuance_date: body.issuance_date || null,
            processing_time: body.processing_time || null,
            notes: body.notes || null,
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
            .from('documents')
            .update(updates)
            .eq('id', body.id)
            .select()
            .single()

        if (error) {
            console.error('Supabase update error:', error)
            return NextResponse.json(
                { error: `Lỗi khi cập nhật: ${error.message}` },
                { status: 500 },
            )
        }

        return NextResponse.json({ data })
    } catch (err: any) {
        console.error('API PUT /documents error:', err)
        return NextResponse.json(
            { error: 'Lỗi máy chủ nội bộ' },
            { status: 500 },
        )
    }
}

// ─── DELETE: Xóa nhiều văn bản + reorder STT ──────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json()
        const { ids, doc_type, status } = body

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { error: 'Danh sách ID không hợp lệ' },
                { status: 400 },
            )
        }
        if (!doc_type || !status) {
            return NextResponse.json(
                { error: 'Thiếu doc_type hoặc status' },
                { status: 400 },
            )
        }

        const supabase = await createClient()

        // Xóa các documents
        const { error: delError } = await supabase
            .from('documents')
            .delete()
            .in('id', ids)

        if (delError) {
            console.error('Supabase delete error:', delError)
            return NextResponse.json(
                { error: `Lỗi khi xóa: ${delError.message}` },
                { status: 500 },
            )
        }

        // Reorder STT: lấy tất cả documents còn lại, sắp xếp theo stt cũ rồi gán lại 1, 2, 3...
        const { data: remaining } = await supabase
            .from('documents')
            .select('id, stt')
            .eq('doc_type', doc_type)
            .eq('status', status)
            .order('stt', { ascending: true })

        if (remaining && remaining.length > 0) {
            const updates = remaining.map((doc, idx) => ({
                id: doc.id,
                stt: idx + 1,
            }))

            // Batch update STT
            for (const u of updates) {
                await supabase
                    .from('documents')
                    .update({ stt: u.stt })
                    .eq('id', u.id)
            }
        }

        return NextResponse.json({ deleted: ids.length })
    } catch (err: any) {
        console.error('API DELETE /documents error:', err)
        return NextResponse.json(
            { error: 'Lỗi máy chủ nội bộ' },
            { status: 500 },
        )
    }
}
