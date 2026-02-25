'use client'

import { useState } from 'react'
import { Upload, Terminal, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export default function ImportPage() {
    const [log, setLog] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState(false)

    async function handleImport() {
        if (!confirm('⚠️ Thao tác này sẽ XÓA TOÀN BỘ dữ liệu cũ và import lại. Tiếp tục?')) return

        setLoading(true)
        setDone(false)
        setError(false)
        setLog(['⏳ Đang gửi yêu cầu import đến server...'])

        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                // Không set timeout - import có thể mất vài phút cho ~1000 records/sheet
            })

            if (!res.ok) {
                const text = await res.text()
                setLog(prev => [...prev, `❌ Server lỗi ${res.status}: ${text.slice(0, 200)}`])
                setError(true)
                return
            }

            const data = await res.json()
            if (data.logs) setLog(data.logs)
            setError(!!data.error)
            setDone(!data.error)

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setLog(prev => [...prev, `❌ Lỗi kết nối: ${msg}`])
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-3xl space-y-6">
            <div>
                <h1 className="text-xl font-bold text-slate-800">Import Dữ Liệu</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                    Import dữ liệu từ file Excel VBQPPL 2026 vào database Supabase
                </p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h2 className="font-semibold text-blue-800 mb-2">📋 Thông tin Import</h2>
                <ul className="text-sm text-blue-700 space-y-1">
                    <li>• File: <code className="bg-blue-100 px-1 rounded">Docs/2026-Theo Doi Tien Do Ban Hanh VBQPPL.xlsx</code></li>
                    <li>• Sheets: NQ cần/đã xử lý, QĐ UBND cần/đã xử lý, QĐ CT UBND</li>
                    <li>• Cơ quan soạn thảo mới sẽ được tạo tự động</li>
                    <li>• Dữ liệu cũ sẽ bị <strong>xóa trắng</strong> trước khi import lại</li>
                    <li className="text-blue-600 font-medium">• ⏱️ Quá trình có thể mất 1-3 phút (không tắt tab)</li>
                </ul>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold text-orange-700">Lưu ý quan trọng</p>
                    <p className="text-sm text-orange-600 mt-1">
                        Import sẽ xóa TOÀN BỘ dữ liệu trong bảng <code>documents</code> và <code>agencies</code>, rồi
                        import lại từ Excel. Thao tác không thể hoàn tác.
                    </p>
                </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleImport}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading
                        ? <><Loader className="w-5 h-5 animate-spin" /> Đang import (chờ vài phút)...</>
                        : <><Upload className="w-5 h-5" /> Bắt đầu Import</>
                    }
                </button>
            </div>

            {/* Log */}
            {log.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-2 text-slate-400 mb-3">
                        <Terminal className="w-4 h-4" /> Import Log
                    </div>
                    {log.map((line, i) => (
                        <div key={i} className={
                            line.startsWith('❌') ? 'text-red-400' :
                                line.startsWith('✅') ? 'text-green-400' :
                                    line.startsWith('⚠️') ? 'text-yellow-400' :
                                        line.startsWith('🎉') ? 'text-green-300 font-bold' :
                                            'text-slate-300'
                        }>
                            {line}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-center gap-2 text-blue-400 animate-pulse mt-2">
                            <Loader className="w-3 h-3 animate-spin" /> Đang xử lý...
                        </div>
                    )}
                    {done && (
                        <div className="flex items-center gap-2 mt-3 text-green-400 font-semibold">
                            <CheckCircle className="w-4 h-4" /> Import hoàn tất! Reload trang để xem dữ liệu mới.
                        </div>
                    )}
                    {error && !loading && (
                        <div className="flex items-center gap-2 mt-3 text-red-400">
                            <AlertCircle className="w-4 h-4" /> Import thất bại. Kiểm tra log ở trên.
                        </div>
                    )}
                </div>
            )}

            {/* Hướng dẫn thủ công */}
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
                <h3 className="font-semibold text-slate-700 mb-3">🔧 Hoặc import thủ công bằng Python</h3>
                <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{`# 1. Cài đặt dependencies
pip install openpyxl supabase python-dotenv

# 2. Đảm bảo .env.local có SUPABASE_SERVICE_ROLE_KEY

# 3. Chạy script
cd E:\\WEB\\VBPL Tracking
python scripts/import_excel.py`}
                </pre>
            </div>
        </div>
    )
}
