import { redirect } from 'next/navigation'

// Route / trong nhóm (app) → redirect về /dashboard
export default function AppRootPage() {
    redirect('/dashboard')
}
