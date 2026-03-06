'use client'
import { Bell, RefreshCw } from 'lucide-react'
import { usePathname } from 'next/navigation'

const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/shipments': 'Shipments',
    '/settings': 'Settings',
}

export default function TopBar() {
    const pathname = usePathname()
    const base = '/' + pathname.split('/')[1]
    const title = titles[base] || 'Logistics Tracking'

    return (
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4 shrink-0">
            <div className="flex-1">
                <h1 className="text-lg font-semibold text-white">{title}</h1>
                <p className="text-xs text-gray-500">Manage your shipments &amp; tracking</p>
            </div>
            <div className="flex items-center gap-2">
                <button className="btn-ghost">
                    <RefreshCw size={16} />
                </button>
                <button className="btn-ghost relative">
                    <Bell size={16} />
                </button>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white ml-1">
                    A
                </div>
            </div>
        </header>
    )
}
