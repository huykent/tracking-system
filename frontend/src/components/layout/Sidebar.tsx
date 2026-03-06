'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Package, Settings, Truck, Activity, ChevronRight
} from 'lucide-react'

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/shipments', label: 'Shipments', icon: Package },
    { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
    const pathname = usePathname()
    return (
        <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
            {/* Logo */}
            <div className="h-16 flex items-center px-5 border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <Truck size={16} className="text-white" />
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-white leading-tight">LogTrack</p>
                        <p className="text-xs text-gray-500">Admin Panel</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                ${active
                                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                        >
                            <Icon size={17} className={active ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'} />
                            {label}
                            {active && <ChevronRight size={14} className="ml-auto text-indigo-500" />}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom info */}
            <div className="px-4 py-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-gray-500">System Online</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">v2.0.0</p>
            </div>
        </aside>
    )
}
