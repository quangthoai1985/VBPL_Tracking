'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Handler } from '@/lib/types'
import { useToast } from '@/components/Toast'

export default function UsersManagementPage() {
    const [handlers, setHandlers] = useState<Handler[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const toast = useToast()

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingHandler, setEditingHandler] = useState<Handler | null>(null)
    const [formData, setFormData] = useState({ name: '', is_active: true })
    const [isSaving, setIsSaving] = useState(false)

    // Delete confirmation state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deletingHandler, setDeletingHandler] = useState<Handler | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        fetchHandlers()
    }, [])

    const fetchHandlers = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/handlers')
            if (!response.ok) throw new Error('Không thể tải dữ liệu chuyên viên')
            const data = await response.json()
            setHandlers(data)
        } catch (err: any) {
            setError(err.message || 'Lỗi không xác định')
            toast.error(err.message || 'Lỗi lấy dữ liệu chuyên viên')
        } finally {
            setLoading(false)
        }
    }

    const handleOpenForm = (handler?: Handler) => {
        if (handler) {
            setEditingHandler(handler)
            setFormData({ name: handler.name, is_active: handler.is_active })
        } else {
            setEditingHandler(null)
            setFormData({ name: '', is_active: true })
        }
        setIsFormOpen(true)
    }

    const handleCloseForm = () => {
        setIsFormOpen(false)
        setEditingHandler(null)
        setFormData({ name: '', is_active: true })
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

        try {
            setIsSaving(true)
            const url = '/api/handlers'
            const method = editingHandler ? 'PUT' : 'POST'
            const body = editingHandler
                ? { id: editingHandler.id, ...formData }
                : formData

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Đã có lỗi xảy ra')
            }

            // Reload data
            toast.success(editingHandler ? 'Cập nhật chuyên viên thành công!' : 'Thêm chuyên viên mới thành công!')
            await fetchHandlers()
            handleCloseForm()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleOpenDelete = (handler: Handler) => {
        setDeletingHandler(handler)
        setIsDeleteModalOpen(true)
    }

    const handleDelete = async () => {
        if (!deletingHandler) return

        try {
            setIsDeleting(true)
            const response = await fetch(`/api/handlers?id=${deletingHandler.id}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Đã có lỗi xảy ra khi xóa')
            }

            // Cập nhật state
            setHandlers(prev => prev.filter(h => h.id !== deletingHandler.id))
            toast.success(`Đã xóa chuyên viên "${deletingHandler.name}"`)
            setIsDeleteModalOpen(false)
            setDeletingHandler(null)
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col flex-1 min-h-0 w-full h-full gap-6">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý chuyên viên</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Thêm, sửa, xóa danh sách các chuyên viên phụ trách xử lý văn bản
                    </p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Thêm chuyên viên
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex gap-3 text-red-700 shrink-0">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Content Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-200 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Tên chuyên viên</th>
                                <th className="px-6 py-4">Trạng thái</th>
                                <th className="px-6 py-4">Ngày tạo</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Đang tải dữ liệu...
                                        </div>
                                    </td>
                                </tr>
                            ) : handlers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        Chưa có chuyên viên nào. Hãy thêm mới.
                                    </td>
                                </tr>
                            ) : (
                                handlers.map((handler) => (
                                    <tr key={handler.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 text-gray-500">{handler.id}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{handler.name}</td>
                                        <td className="px-6 py-4">
                                            {handler.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    <XCircle className="w-3.5 h-3.5" /> Đã ẩn
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(handler.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenForm(handler)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenDelete(handler)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Edit/Add */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingHandler ? 'Chỉnh sửa chuyên viên' : 'Thêm chuyên viên mới'}
                            </h3>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Tên chuyên viên <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Nhập tên chuyên viên..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 select-none">
                                        Trạng thái hoạt động
                                    </label>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                    disabled={isSaving}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || !formData.name.trim()}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingHandler ? 'Cập nhật' : 'Thêm mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Delete Confirmation */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Xác nhận xóa</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Bạn có chắc chắn muốn xóa chuyên viên <span className="font-semibold text-gray-900">"{deletingHandler?.name}"</span> không? Hành động này không thể hoàn tác.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-1"
                                disabled={isDeleting}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex-1 flex items-center justify-center gap-2"
                            >
                                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
