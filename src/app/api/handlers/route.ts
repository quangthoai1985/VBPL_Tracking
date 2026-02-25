import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Handler } from '@/lib/types'

export async function GET() {
    try {
        const supabase = await createClient()
        // Lấy danh sách chuyên viên có trạng thái is_active = true
        const { data, error } = await supabase
            .from('handlers')
            .select('*')
            .order('id', { ascending: true })

        if (error) throw error

        return NextResponse.json(data as Handler[])
    } catch (error) {
        console.error('Error fetching handlers:', error)
        return NextResponse.json({ error: 'Lỗi khi lấy dữ liệu chuyên viên' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name } = body

        if (!name) {
            return NextResponse.json({ error: 'Tên chuyên viên không được bỏ trống' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('handlers')
            .insert([{ name, is_active: true }])
            .select()
            .single()

        if (error) {
            if (error.code === '23505') { // Lỗi trùng lặp từ PostgreSQL
                return NextResponse.json({ error: 'Tên chuyên viên đã tồn tại' }, { status: 400 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error adding handler:', error)
        return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, name, is_active } = body

        if (!id || !name) {
            return NextResponse.json({ error: 'ID và Tên không được bỏ trống' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('handlers')
            .update({ name, is_active })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') { // Lỗi trùng lặp
                return NextResponse.json({ error: 'Tên chuyên viên đã tồn tại' }, { status: 400 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error updating handler:', error)
        return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const id = url.searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Không tìm thấy ID' }, { status: 400 })
        }

        const { error } = await supabase
            .from('handlers')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting handler:', error)
        return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 })
    }
}
