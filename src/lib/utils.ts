import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—'
    return dateStr
}

export function truncate(str: string, maxLen = 80): string {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '...'
}
