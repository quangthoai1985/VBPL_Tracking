'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────
type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
    id: string
    message: string
    variant: ToastVariant
    duration?: number
}

interface ToastContextValue {
    toast: (message: string, variant?: ToastVariant, duration?: number) => void
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
}

// ─── Context ───────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
    return ctx
}

// ─── Config ────────────────────────────────────────────────────────────────────
const VARIANT_CONFIG: Record<ToastVariant, {
    icon: typeof CheckCircle
    bg: string
    border: string
    iconColor: string
    progressColor: string
}> = {
    success: {
        icon: CheckCircle,
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/95',
        border: 'border-emerald-200 dark:border-emerald-800',
        iconColor: 'text-emerald-500',
        progressColor: 'bg-emerald-400',
    },
    error: {
        icon: XCircle,
        bg: 'bg-red-50/95 dark:bg-red-950/95',
        border: 'border-red-200 dark:border-red-800',
        iconColor: 'text-red-500',
        progressColor: 'bg-red-400',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-amber-50/95 dark:bg-amber-950/95',
        border: 'border-amber-200 dark:border-amber-800',
        iconColor: 'text-amber-500',
        progressColor: 'bg-amber-400',
    },
    info: {
        icon: Info,
        bg: 'bg-blue-50/95 dark:bg-blue-950/95',
        border: 'border-blue-200 dark:border-blue-800',
        iconColor: 'text-blue-500',
        progressColor: 'bg-blue-400',
    },
}

const DEFAULT_DURATION = 4000

// ─── Single Toast ──────────────────────────────────────────────────────────────
function ToastMessage({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
    const config = VARIANT_CONFIG[item.variant]
    const Icon = config.icon
    const duration = item.duration ?? DEFAULT_DURATION
    const [visible, setVisible] = useState(false)
    const [exiting, setExiting] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => {
        // Enter animation
        requestAnimationFrame(() => setVisible(true))
        // Auto dismiss
        timerRef.current = setTimeout(() => {
            setExiting(true)
            setTimeout(() => onDismiss(item.id), 300)
        }, duration)
        return () => clearTimeout(timerRef.current)
    }, [duration, item.id, onDismiss])

    function handleClose() {
        clearTimeout(timerRef.current)
        setExiting(true)
        setTimeout(() => onDismiss(item.id), 300)
    }

    return (
        <div
            className={cn(
                'relative flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm',
                'transition-all duration-300 ease-out max-w-[420px] w-full overflow-hidden',
                config.bg, config.border,
                visible && !exiting
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-8 opacity-0',
            )}
        >
            {/* Icon */}
            <div className={cn('shrink-0 mt-0.5', config.iconColor)}>
                <Icon className="w-5 h-5" />
            </div>

            {/* Message */}
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug pr-6">
                {item.message}
            </p>

            {/* Close button */}
            <button
                onClick={handleClose}
                className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-black/5 transition-colors"
            >
                <X className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5 rounded-b-xl overflow-hidden">
                <div
                    className={cn('h-full rounded-b-xl', config.progressColor)}
                    style={{
                        animation: `toast-progress ${duration}ms linear forwards`,
                    }}
                />
            </div>
        </div>
    )
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message: string, variant: ToastVariant = 'info', duration?: number) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        setToasts(prev => [...prev, { id, message, variant, duration }])
    }, [])

    const value: ToastContextValue = {
        toast: addToast,
        success: useCallback((m: string) => addToast(m, 'success'), [addToast]),
        error: useCallback((m: string) => addToast(m, 'error'), [addToast]),
        warning: useCallback((m: string) => addToast(m, 'warning'), [addToast]),
        info: useCallback((m: string) => addToast(m, 'info'), [addToast]),
    }

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* Toast container – fixed top-right */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastMessage item={t} onDismiss={dismiss} />
                    </div>
                ))}
            </div>

            {/* Progress bar animation */}
            <style jsx global>{`
                @keyframes toast-progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </ToastContext.Provider>
    )
}
