"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { LayoutDashboard, Settings } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const { t, language, setLanguage } = useLanguage();

    return (
        <div className="w-64 bg-neutral-900 border-r border-neutral-800 h-screen flex flex-col hidden md:flex text-white">
            <div className="p-6">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    TrackingOS
                </h2>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                <Link href="/"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/' ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
                    <LayoutDashboard size={20} />
                    <span className="font-medium">{t('dashboard')}</span>
                </Link>
                <Link href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/settings' ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
                    <Settings size={20} />
                    <span className="font-medium">{t('settings')}</span>
                </Link>
            </nav>

            <div className="p-6 border-t border-neutral-800">
                <div className="text-sm text-neutral-500 mb-2 font-medium">{t('language')}</div>
                <div className="flex bg-neutral-800 rounded-lg p-1">
                    <button
                        onClick={() => setLanguage('vi')}
                        className={`flex-1 py-1 text-sm font-medium rounded-md transition-colors ${language === 'vi' ? 'bg-blue-500 text-white' : 'text-neutral-400 hover:text-white'}`}>
                        VI
                    </button>
                    <button
                        onClick={() => setLanguage('en')}
                        className={`flex-1 py-1 text-sm font-medium rounded-md transition-colors ${language === 'en' ? 'bg-blue-500 text-white' : 'text-neutral-400 hover:text-white'}`}>
                        EN
                    </button>
                </div>
            </div>
        </div>
    );
}
