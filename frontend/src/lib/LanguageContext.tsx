"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'vi';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations = {
    en: {
        app_title: "Smart Logistics Tracking",
        total_shipments: "Total Shipments",
        delivered: "Delivered",
        delivering: "Delivering",
        failed_fake: "Failed / Fake",
        recent_shipments: "Recent Shipments",
        tracking_number: "Tracking Number",
        carrier: "Carrier",
        status: "Status",
        actions: "Actions",
        live_map: "Live Cargo Map",
        add_tracking: "Add Tracking",
        delete: "Delete",
        dashboard: "Dashboard",
        settings: "Settings",
        language: "Language",
        domain_config: "Domain Configuration",
        telegram_bot: "Telegram Bot Config",
        ship24_api_key: "Ship24 API Key",
        admin_panel: "Admin Panel / Settings",
        save: "Save",
        note: "Note",
        source: "Source Platform"
    },
    vi: {
        app_title: "Nền tảng Theo dõi Vận tải Thông minh",
        total_shipments: "Tổng Đơn",
        delivered: "Đã giao",
        delivering: "Đang giao",
        failed_fake: "Lỗi / Giả mạo",
        recent_shipments: "Đơn hàng Gần đây",
        tracking_number: "Mã Vận đơn",
        carrier: "Nhà vận chuyển",
        status: "Trạng thái",
        actions: "Hành động",
        live_map: "Bản đồ Hàng hóa",
        add_tracking: "Thêm Vận đơn",
        delete: "Xóa",
        dashboard: "Bảng điều khiển",
        settings: "Cài đặt",
        language: "Ngôn ngữ",
        domain_config: "Cấu hình Tên miền",
        telegram_bot: "Cấu hình Bot Telegram",
        ship24_api_key: "Mã API Ship24",
        admin_panel: "Cài đặt & Quản trị Hệ thống",
        save: "Lưu",
        note: "Ghi chú",
        source: "Nền tảng Nguồn"
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('vi');

    useEffect(() => {
        const savedLang = localStorage.getItem('lang') as Language;
        if (savedLang && (savedLang === 'en' || savedLang === 'vi')) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        localStorage.setItem('lang', lang);
        setLanguageState(lang);
    };

    const t = (key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (translations[language] as any)[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
