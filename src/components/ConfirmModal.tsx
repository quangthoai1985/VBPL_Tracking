'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

interface Props {
    open: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    loading?: boolean
}

export default function ConfirmModal({
    open, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel, loading = false
}: Props) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [open])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
                onClick={!loading ? onCancel : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slideUp">
                <div className="p-6">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="shrink-0 w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 leading-tight mb-2">
                                {title}
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex items-center justify-center gap-3 border-t border-slate-100">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="w-full px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={cn(
                            'w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all',
                            'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/25',
                            'disabled:opacity-60 disabled:cursor-not-allowed',
                        )}
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.15s ease-out;
                }
                .animate-slideUp {
                    animation: slideUp 0.25s ease-out;
                }
            `}</style>
        </div>
    )
}
