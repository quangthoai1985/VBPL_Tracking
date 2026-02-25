'use client'

import { useState, useRef } from 'react'
import { Upload, Terminal, CheckCircle, AlertCircle, Loader, FileSpreadsheet } from 'lucide-react'

export default function ImportPage() {
    const [log, setLog] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) setSelectedFile(file)
    }

    async function handleImport() {
        if (!selectedFile) {
            setLog(['❌ Vui lòng chọn file Excel trước khi import.'])
            setError(true)
            return
        }

        if (!confirm('⚠️ Thao tác này sẽ XÓA TOÀN BỘ dữ liệu cũ và import lại. Tiếp tục?')) return

        setLoading(true)
        setDone(false)
        setError(false)
        setLog(['⏳ Đang gửi file Excel đến server...'])

        try {
            const formData = new FormData()
            formData.append('file', selectedFile)

            const res = await fetch('/api/import', {
                method: 'POST',
                body: formData,
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
                    <li>• Chọn file <code className="bg-blue-100 px-1 rounded">.xlsx</code> từ máy tính</li>
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

            {/* File picker + Import button */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        {selectedFile ? selectedFile.name : 'Chọn file Excel...'}
                    </button>

                    <button
                        onClick={handleImport}
                        disabled={loading || !selectedFile}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading
                            ? <><Loader className="w-5 h-5 animate-spin" /> Đang import...</>
                            : <><Upload className="w-5 h-5" /> Bắt đầu Import</>
                        }
                    </button>
                </div>

                {selectedFile && (
                    <p className="text-xs text-slate-400">
                        📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                )}
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
        </div>
    )
}
